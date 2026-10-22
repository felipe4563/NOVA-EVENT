"use server";

import { and, asc, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { forbidden } from "next/navigation";
import { z } from "zod";
import { paymentInstallments, quoteItems, quoteVersions, quotes, supplierBusy } from "@/db/schema";
import { audit, requireEquipo } from "@/lib/auth";
import { detalleEvento } from "@/lib/cotizacion/aceptacion";
import { estadoDisponibilidad } from "@/lib/cotizacion/disponibilidad";
import { aCentavos } from "@/lib/cotizacion/dinero";
import { leerLineaCongelada } from "@/lib/cotizacion/propuesta";
import { RE_HORA, diasEntre, esFechaValida, hoy as hoyFn } from "@/lib/fechas";
import { hasPermission } from "@/lib/permissions";
import { correrFechas } from "@/lib/saldos/plan";
import { unirSaltos } from "@/lib/texto";
import {
  CANCELADA,
  type CampoMovimiento,
  type DatosMovimiento,
  NO_ACEPTADA,
  NO_EXISTE,
  type ValoresMovimiento,
  conComprobante,
  escribirMovimiento,
  leerMovimiento,
  validarMovimiento,
} from "./movimientos";
import { type Tx, bloquear, borrarPlanes, cobradoNeto, pagadoNetoLinea, tieneMovimientos, transaccion } from "./planes";

/*
 * Cambiar la fecha y cancelar un evento aceptado. Tocan la cotización, los días ocupados de los proveedores
 * y los planes de pago: por eso piden, además de «Saldos: editar», «Cotizaciones: editar».
 */

async function permisoEvento() {
  const yo = await requireEquipo("saldos.editar");
  if (!hasPermission(yo, "cotizaciones.editar")) forbidden();
  return yo;
}

const esUuid = (v: string) => z.uuid().safeParse(v).success;
const MISMA_FECHA = "Es la misma fecha del evento.";

/* ── Cambiar fecha ──────────────────────────────────────────── */

type CampoFecha = "fecha" | "inicio" | "fin";
export type Disponibilidad = "libre" | "parcial" | "ocupado";
export type LineaRevision = { proveedor: string; estado: Disponibilidad };

const horaOpcional = z.union([z.literal(""), z.string().regex(RE_HORA, { error: "Hora no válida" })]);

/** Fecha posterior a hoy y horario opcional (las dos horas o ninguna; fin después de inicio, como en el calendario). */
const esquemaFecha = (hoy: string) =>
  z
    .object({
      fecha: z
        .string()
        .refine(esFechaValida, { error: "Elige la fecha" })
        .refine((f) => f > hoy, { error: "Debe ser posterior a hoy" }),
      inicio: horaOpcional,
      fin: horaOpcional,
    })
    .superRefine((d, ctx) => {
      if (!d.inicio && d.fin) ctx.addIssue({ code: "custom", path: ["inicio"], message: "Indica la hora de inicio" });
      if (d.inicio && !d.fin) ctx.addIssue({ code: "custom", path: ["fin"], message: "Indica la hora de fin" });
      if (d.inicio && d.fin && d.fin <= d.inicio) ctx.addIssue({ code: "custom", path: ["fin"], message: "Debe ser después de la hora de inicio" });
    });

type DatosFecha = z.output<ReturnType<typeof esquemaFecha>>;

function validarFecha(valores: Record<CampoFecha, string>, hoy: string): { datos: DatosFecha } | { errores: Partial<Record<CampoFecha, string>> } {
  const d = esquemaFecha(hoy).safeParse(valores);
  if (d.success) return { datos: d.data };
  const errores: Partial<Record<CampoFecha, string>> = {};
  for (const i of d.error.issues) errores[i.path[0] as CampoFecha] ??= i.message;
  return { errores };
}

type Cotizacion = NonNullable<Awaited<ReturnType<typeof bloquear>>>;

/**
 * Disponibilidad de cada proveedor confirmado en la nueva fecha y horario. No cuentan los días ocupados
 * de esta misma cotización (se mueven con ella). «Parcial» es un aviso: solo «ocupado» pide cambiar de todos modos.
 */
async function revisarLineas(tx: Tx, c: Cotizacion, fecha: string, horario: { inicio: string | null; fin: string | null }) {
  if (!c.acceptedVersionId) return [];
  const lineas = await tx
    .select({ id: quoteItems.id, supplierId: quoteItems.supplierId, busyId: quoteItems.busyId, confirmation: quoteItems.confirmation, label: quoteItems.label, frozen: quoteItems.frozen })
    .from(quoteItems)
    .where(eq(quoteItems.versionId, c.acceptedVersionId))
    .orderBy(asc(quoteItems.sortOrder));
  const propios = lineas.flatMap((l) => (l.busyId ? [l.busyId] : []));
  const confirmadas = lineas.flatMap((l) => (l.confirmation === "confirmed" && l.supplierId ? [{ ...l, supplierId: l.supplierId }] : []));
  if (!confirmadas.length) return [];
  const bloques = await tx
    .select({ supplierId: supplierBusy.supplierId, startTime: supplierBusy.startTime, endTime: supplierBusy.endTime })
    .from(supplierBusy)
    .where(
      and(
        eq(supplierBusy.date, fecha),
        inArray(supplierBusy.supplierId, [...new Set(confirmadas.map((l) => l.supplierId))]),
        propios.length ? notInArray(supplierBusy.id, propios) : undefined,
      ),
    );
  return confirmadas.map((l) => {
    const f = leerLineaCongelada(l.frozen);
    return {
      id: l.id,
      supplierId: l.supplierId,
      busyId: l.busyId,
      proveedor: f?.proveedor ?? f?.etiqueta ?? l.label,
      estado: estadoDisponibilidad(
        bloques.filter((b) => b.supplierId === l.supplierId),
        horario,
      ),
    };
  });
}

/** Horario del evento en la nueva fecha: el elegido o, si se deja vacío, el que ya tenía. */
const horarioNuevo = (d: DatosFecha, c: Cotizacion) => (d.inicio && d.fin ? { inicio: d.inicio, fin: d.fin } : { inicio: c.startTime, fin: c.endTime });

/** Solo lectura: cómo quedan los proveedores confirmados en la nueva fecha (paso «Revisar»). Un texto = error. */
export async function revisarFecha(quoteId: string, fecha: string, inicio = "", fin = ""): Promise<LineaRevision[] | string> {
  await permisoEvento();
  if (!esUuid(quoteId)) return NO_EXISTE;
  const v = validarFecha({ fecha: String(fecha ?? ""), inicio: String(inicio ?? ""), fin: String(fin ?? "") }, await hoyFn());
  if ("errores" in v) return Object.values(v.errores)[0] ?? "Revisa la fecha y el horario.";
  const d = v.datos;
  const r = await transaccion(async (tx) => {
    const [c] = await tx.select().from(quotes).where(eq(quotes.id, quoteId));
    if (!c) return NO_EXISTE;
    if (c.status === "cancelled") return CANCELADA;
    if (c.status !== "accepted") return NO_ACEPTADA;
    if (c.eventDate === d.fecha) return MISMA_FECHA;
    return { lineas: (await revisarLineas(tx, c, d.fecha, horarioNuevo(d, c))).map((l) => ({ proveedor: l.proveedor, estado: l.estado })) };
  });
  return typeof r === "string" ? r : r.lineas;
}

export type EstadoFecha = { errores?: Partial<Record<CampoFecha, string>>; error?: string; ok?: string; valores?: Partial<Record<CampoFecha, string>> } | undefined;

/** Corre las cuotas con algo por cubrir (de la pareja y de cada proveedor) `dias` días, nunca antes de hoy. */
async function correrPlanes(tx: Tx, quoteId: string, dias: number, hoy: string) {
  const cuotas = await tx.select().from(paymentInstallments).where(eq(paymentInstallments.quoteId, quoteId)).orderBy(asc(paymentInstallments.sortOrder), asc(paymentInstallments.dueDate));
  const planes = new Map<string | null, typeof cuotas>();
  for (const q of cuotas) planes.set(q.itemId, [...(planes.get(q.itemId) ?? []), q]);
  for (const [itemId, plan] of planes) {
    const pagado = itemId ? await pagadoNetoLinea(tx, itemId) : await cobradoNeto(tx, quoteId);
    const corridas = correrFechas(
      plan.map((q) => ({ id: q.id, nombre: q.name, monto: q.amountCents, vence: q.dueDate })),
      pagado,
      dias,
      hoy,
    );
    for (const [i, q] of corridas.entries()) {
      if (q.vence !== plan[i].dueDate) await tx.update(paymentInstallments).set({ dueDate: q.vence }).where(eq(paymentInstallments.id, q.id));
    }
  }
}

/**
 * Cambia la fecha (y opcionalmente el horario) de un evento aceptado:
 * los proveedores libres mueven su día ocupado; los ocupados (solo con «forzar») quedan «Por confirmar» y sin día reservado;
 * las cuotas pendientes se corren los mismos días.
 */
export async function cambiarFecha(quoteId: string, _prev: EstadoFecha, formData: FormData): Promise<EstadoFecha> {
  const yo = await permisoEvento();
  const valores = { fecha: String(formData.get("fecha") ?? ""), inicio: String(formData.get("inicio") ?? "").trim(), fin: String(formData.get("fin") ?? "").trim() };
  const forzar = formData.get("forzar") === "on";
  if (!esUuid(quoteId)) return { error: NO_EXISTE, valores };
  const hoy = await hoyFn();
  const v = validarFecha(valores, hoy);
  if ("errores" in v) return { errores: v.errores, valores };
  const d = v.datos;

  const r = await transaccion(async (tx) => {
    const c = await bloquear(tx, quoteId);
    if (!c) return NO_EXISTE;
    if (c.status === "cancelled") return CANCELADA;
    if (c.status !== "accepted") return NO_ACEPTADA;
    if (c.eventDate === d.fecha) return MISMA_FECHA;
    const horario = horarioNuevo(d, c);

    // Se vuelve a revisar con la cotización bloqueada: alguien pudo ocupar a un proveedor desde «Revisar».
    const lineas = await revisarLineas(tx, c, d.fecha, horario);
    const ocupadas = lineas.filter((l) => l.estado === "ocupado");
    if (ocupadas.length && !forzar) {
      return `Ocupados en la nueva fecha: ${ocupadas.map((l) => l.proveedor).join(", ")}. Marca «Cambiar de todos modos» para seguir.`;
    }

    for (const l of lineas) {
      if (l.estado === "ocupado") {
        // Como al desconfirmar: sin día reservado y, si no tiene pagos, sin plan (se arma al volver a confirmar).
        if (l.busyId) await tx.delete(supplierBusy).where(eq(supplierBusy.id, l.busyId));
        if (!(await tieneMovimientos(tx, { itemId: l.id }))) await borrarPlanes(tx, { itemId: l.id });
        await tx.update(quoteItems).set({ confirmation: "pending", busyId: null }).where(eq(quoteItems.id, l.id));
        continue;
      }
      // El detalle («Evento de X (COT-…)») no lleva la fecha: queda igual.
      const [movido] = l.busyId
        ? await tx
            .update(supplierBusy)
            .set({ date: d.fecha, startTime: horario.inicio, endTime: horario.fin })
            .where(eq(supplierBusy.id, l.busyId))
            .returning({ id: supplierBusy.id })
        : [];
      if (!movido) {
        // Su día ocupado ya no estaba (lo quitaron en el calendario): se vuelve a reservar en la nueva fecha.
        const [b] = await tx
          .insert(supplierBusy)
          .values({
            supplierId: l.supplierId,
            date: d.fecha,
            startTime: horario.inicio,
            endTime: horario.fin,
            detail: detalleEvento(c.clientName, c.code),
            byStaff: true,
            createdById: yo.id,
          })
          .returning({ id: supplierBusy.id });
        await tx.update(quoteItems).set({ busyId: b.id }).where(eq(quoteItems.id, l.id));
      }
    }

    await tx.update(quotes).set({ eventDate: d.fecha, startTime: horario.inicio, endTime: horario.fin }).where(eq(quotes.id, quoteId));
    await correrPlanes(tx, quoteId, diasEntre(c.eventDate, d.fecha), hoy);
    return { de: c.eventDate, pendientes: ocupadas.map((l) => l.proveedor) };
  });
  if (typeof r === "string") return { error: r, valores };

  await audit({ action: "saldo.evento.fecha", userId: yo.id, entity: "cotizacion", entityId: quoteId, meta: { de: r.de, a: d.fecha, pendientes: r.pendientes } });
  refresh();
  return {
    ok: r.pendientes.length ? `Fecha cambiada. Quedaron por confirmar: ${r.pendientes.join(", ")}.` : "Fecha cambiada.",
  };
}

/* ── Cancelar ───────────────────────────────────────────────── */

type CampoCancelar = "motivo" | CampoMovimiento;
export type EstadoCancelar =
  | {
      errores?: Partial<Record<CampoCancelar, string>>;
      error?: string;
      ok?: string;
      valores?: Partial<Record<Exclude<CampoCancelar, "comprobante">, string>>;
      /** Nombre del comprobante elegido: el campo de archivo no se puede volver a llenar solo. */
      archivo?: string;
    }
  | undefined;

const motivoValido = z.string().trim().min(1, { error: "Escribe el motivo" }).max(300, { error: "Máximo 300 caracteres" });

/**
 * Cancela un evento aceptado: queda como registro (solo lectura salvo devoluciones), se liberan los días ocupados
 * de sus proveedores y, si se indica un monto, se registra la devolución a la pareja en la misma transacción.
 */
export async function cancelarEvento(quoteId: string, _prev: EstadoCancelar, formData: FormData): Promise<EstadoCancelar> {
  const yo = await permisoEvento();
  const mov = leerMovimiento(formData);
  const motivo = unirSaltos(String(formData.get("motivo") ?? "")).trim();
  const valores: Partial<ValoresMovimiento> & { motivo: string } = { ...mov.valores, motivo };
  if (!esUuid(quoteId)) return { error: NO_EXISTE, valores };

  // Monto a devolver: de 0 a lo cobrado. Con más de 0 se piden los datos de la devolución (como «Registrar devolución»).
  const monto = aCentavos(mov.valores.monto || "0");
  const comprobante = monto ? mov.comprobante : null;
  const base = { valores, archivo: comprobante?.name };
  const errores: Partial<Record<CampoCancelar, string>> = {};
  const m = motivoValido.safeParse(motivo);
  if (!m.success) errores.motivo = m.error.issues[0].message;
  let devolucion: DatosMovimiento | null = null;
  if (monto === null) errores.monto = "Monto no válido (ej.: 1.500 o 1.500,50)";
  else if (monto > 0) {
    const v = validarMovimiento(mov.valores, comprobante, await hoyFn());
    if ("errores" in v) Object.assign(errores, v.errores);
    else devolucion = v.datos;
  }
  if (!m.success || Object.keys(errores).length) return { errores, ...base };

  const r = await conComprobante(quoteId, comprobante, (archivo) =>
    transaccion(async (tx) => {
      const c = await bloquear(tx, quoteId);
      if (!c) return NO_EXISTE;
      if (c.status === "cancelled") return "El evento ya está cancelado.";
      if (c.status !== "accepted") return "Solo se cancela un evento aceptado.";

      // Días ocupados que crearon las confirmaciones: se liberan. La confirmación de cada línea queda como estaba.
      const versiones = tx.select({ id: quoteVersions.id }).from(quoteVersions).where(eq(quoteVersions.quoteId, quoteId));
      const ocupados = await tx
        .select({ busyId: quoteItems.busyId })
        .from(quoteItems)
        .where(and(inArray(quoteItems.versionId, versiones), isNotNull(quoteItems.busyId)));
      const ids = ocupados.flatMap((o) => (o.busyId ? [o.busyId] : []));
      if (ids.length) {
        await tx.delete(supplierBusy).where(inArray(supplierBusy.id, ids));
        await tx.update(quoteItems).set({ busyId: null }).where(inArray(quoteItems.busyId, ids));
      }
      await tx.update(quotes).set({ status: "cancelled", cancelledAt: new Date(), cancelReason: m.data }).where(eq(quotes.id, quoteId));

      // La devolución revisa que no supere lo cobrado; si lo supera, se revierte también la cancelación.
      const movimiento = devolucion ? await escribirMovimiento(tx, "devolucion", quoteId, null, devolucion, archivo, yo.id) : null;
      if (typeof movimiento === "string") return movimiento;
      return { liberados: ids.length, movimiento: movimiento?.id ?? null };
    }),
  );
  if ("errorComprobante" in r) return { errores: { comprobante: r.errorComprobante }, ...base };
  if ("error" in r) return { error: r.error, ...base };

  await audit({
    action: "saldo.evento.cancelado",
    userId: yo.id,
    entity: "cotizacion",
    entityId: quoteId,
    meta: {
      motivo: m.data,
      devolucion: devolucion ? { movimiento: r.valor.movimiento, monto: devolucion.monto, fecha: devolucion.fecha, forma: devolucion.forma } : null,
      liberados: r.valor.liberados,
    },
  });
  refresh();
  return { ok: devolucion ? "Evento cancelado y devolución registrada." : "Evento cancelado." };
}

/* ── Enlace de la pareja ────────────────────────────────────── */

/** Muestra u oculta «Mis pagos» (y sus recibos) en el enlace público. Vale también para un evento cancelado. */
export async function mostrarPagos(quoteId: string, valor: boolean): Promise<string | void> {
  const yo = await requireEquipo("saldos.editar");
  if (!esUuid(quoteId)) return NO_EXISTE;
  const r = await transaccion(async (tx) => {
    const c = await bloquear(tx, quoteId);
    if (!c) return NO_EXISTE;
    if (c.status !== "accepted" && c.status !== "cancelled") return NO_ACEPTADA;
    await tx.update(quotes).set({ showPayments: valor === true }).where(eq(quotes.id, quoteId));
    return { de: c.showPayments };
  });
  if (typeof r === "string") return r;
  await audit({ action: "saldo.enlace.pagos", userId: yo.id, entity: "cotizacion", entityId: quoteId, meta: { de: r.de, a: valor === true } });
  refresh();
}
