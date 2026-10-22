"use server";

import { randomUUID } from "node:crypto";
import { and, eq, max, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { paymentMovements, quoteAdjustments, quoteItems, quoteVersions } from "@/db/schema";
import { ErrorArchivo, MAX_COMPROBANTE, borrarArchivos, guardarComprobante } from "@/lib/archivos";
import { audit, requireEquipo } from "@/lib/auth";
import { aCentavos, formatoBs } from "@/lib/cotizacion/dinero";
import { esFechaValida, hoy as hoyFn } from "@/lib/fechas";
import { FORMAS_PAGO, codigoRecibo } from "@/lib/saldos/recibo";
import {
  MENSAJE_PAGOS_PROVEEDOR,
  type Tx,
  bloquear,
  borrarPlanes,
  cobradoNeto,
  crearPlanProveedor,
  lineaAceptada,
  pagadoNetoLinea,
  reajustarPlanPareja,
  reajustarPlanProveedor,
  tieneMovimientos,
  totalCotizacion,
  transaccion,
} from "../planes";

/*
 * Movimientos de dinero de un evento. Todas siguen el mismo camino:
 * validar → (guardar el comprobante) → transacción: bloquear la cotización, revisar las reglas con sumas frescas, escribir
 * → auditoría → refresh(). Así dos envíos a la vez nunca superan el total: el segundo espera el bloqueo y ve el primero.
 */

const NO_EXISTE = "Esta cotización ya no existe.";
const LINEA_NO_EXISTE = "Esta línea ya no existe.";
const CANCELADA = "El evento está cancelado.";
const NO_ACEPTADA = "La cotización ya no está aceptada.";

const esUuid = (v: string) => z.uuid().safeParse(v).success;

/** De qué cotización es una línea (para bloquearla y para la carpeta del comprobante). */
async function cotizacionDeLinea(itemId: string): Promise<string | null> {
  if (!esUuid(itemId)) return null;
  const [r] = await db
    .select({ quoteId: quoteVersions.quoteId })
    .from(quoteItems)
    .innerJoin(quoteVersions, eq(quoteItems.versionId, quoteVersions.id))
    .where(eq(quoteItems.id, itemId));
  return r?.quoteId ?? null;
}

/* ── Cobros, devoluciones y pagos a proveedores ───────────────── */

type CampoMovimiento = "monto" | "fecha" | "forma" | "referencia" | "nota" | "comprobante";
export type EstadoMovimiento =
  | {
      errores?: Partial<Record<CampoMovimiento, string>>;
      error?: string;
      ok?: string;
      valores?: Partial<Record<Exclude<CampoMovimiento, "comprobante">, string>>;
      /** Nombre del comprobante elegido: el campo de archivo no se puede volver a llenar solo. */
      archivo?: string;
    }
  | undefined;

type Tipo = "cobro" | "devolucion" | "pago_proveedor" | "devolucion_proveedor";

const esquemaMovimiento = (hoy: string) =>
  z.object({
    monto: z
      .string()
      .trim()
      .min(1, { error: "Escribe el monto" })
      .transform((v, ctx) => {
        const c = aCentavos(v);
        if (c === null || c <= 0) {
          ctx.addIssue({ code: "custom", message: "Monto no válido (ej.: 1.500 o 1.500,50)" });
          return z.NEVER;
        }
        return c;
      }),
    fecha: z
      .string()
      .refine(esFechaValida, { error: "Elige la fecha" })
      .refine((f) => f <= hoy, { error: "La fecha no puede ser futura" }),
    forma: z.enum(FORMAS_PAGO, { error: "Elige la forma de pago" }),
    referencia: z.string().trim().max(80, { error: "Máximo 80 caracteres" }),
    nota: z.string().trim().max(300, { error: "Máximo 300 caracteres" }),
  });

type DatosMovimiento = z.output<ReturnType<typeof esquemaMovimiento>>;

/** Reglas e inserción de cada tipo, dentro de la transacción. Devuelve un texto para rechazar. */
async function escribirMovimiento(
  tx: Tx,
  tipo: Tipo,
  quoteId: string,
  itemId: string | null,
  d: DatosMovimiento,
  archivo: { fileKey: string; mime: string } | null,
  yoId: string,
): Promise<{ id: string; recibo: string | null; proveedor: string | null } | string> {
  const c = await bloquear(tx, quoteId);
  if (!c) return NO_EXISTE;
  const conCancelada = tipo === "devolucion" || tipo === "devolucion_proveedor";
  if (c.status === "cancelled" && !conCancelada) return CANCELADA;
  if (c.status !== "accepted" && c.status !== "cancelled") return NO_ACEPTADA;

  let recibo: { receiptYear: number; receiptSeq: number; receiptCode: string } | null = null;
  let proveedor: string | null = null;

  if (tipo === "cobro") {
    const falta = (await totalCotizacion(tx, quoteId)) - (await cobradoNeto(tx, quoteId));
    if (d.monto > falta) return `Supera lo que falta cobrar (${formatoBs(Math.max(0, falta))}).`;
    // Correlativo por año de la fecha del cobro. El bloqueo de la cotización no ordena cobros de cotizaciones
    // distintas: este bloqueo por año (se suelta al terminar la transacción) sí. La restricción única es el respaldo.
    const anio = Number(d.fecha.slice(0, 4));
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`recibo-${anio}`}))`);
    const [u] = await tx.select({ n: max(paymentMovements.receiptSeq) }).from(paymentMovements).where(eq(paymentMovements.receiptYear, anio));
    const seq = (u?.n ?? 0) + 1; // los anulados también cuentan: un número nunca se reutiliza
    recibo = { receiptYear: anio, receiptSeq: seq, receiptCode: codigoRecibo(anio, seq) };
  } else if (tipo === "devolucion") {
    const cobrado = await cobradoNeto(tx, quoteId);
    if (d.monto > cobrado) return `Supera lo cobrado a la pareja (${formatoBs(Math.max(0, cobrado))}).`;
  } else {
    const l = itemId ? await lineaAceptada(tx, itemId, c) : null;
    if (!l) return LINEA_NO_EXISTE;
    proveedor = l.proveedor;
    const pagado = await pagadoNetoLinea(tx, l.id);
    if (tipo === "pago_proveedor") {
      if (l.payer !== "nova") return "Esta línea la paga la pareja directo al proveedor.";
      if (l.confirmation !== "confirmed") return "Este proveedor aún no está confirmado.";
      const falta = l.aPagar - pagado;
      if (d.monto > falta) return `Supera lo que falta pagar a este proveedor (${formatoBs(Math.max(0, falta))}).`;
    } else if (d.monto > pagado) {
      return `Supera lo pagado a este proveedor (${formatoBs(Math.max(0, pagado))}).`;
    }
  }

  const [m] = await tx
    .insert(paymentMovements)
    .values({
      quoteId,
      itemId,
      kind: tipo,
      amountCents: d.monto,
      date: d.fecha,
      method: d.forma,
      reference: d.referencia || null,
      fileKey: archivo?.fileKey ?? null,
      mime: archivo?.mime ?? null,
      ...recibo,
      handledById: yoId,
      note: d.nota || null,
      createdById: yoId,
    })
    .returning({ id: paymentMovements.id });
  return { id: m.id, recibo: recibo?.receiptCode ?? null, proveedor };
}

const OK: Record<Tipo, string> = {
  cobro: "Cobro registrado.",
  devolucion: "Devolución registrada.",
  pago_proveedor: "Pago registrado.",
  devolucion_proveedor: "Devolución del proveedor registrada.",
};

async function registrar(tipo: Tipo, ref: string, formData: FormData): Promise<EstadoMovimiento> {
  const yo = await requireEquipo("saldos.crear");
  const valores = {
    monto: String(formData.get("monto") ?? "").trim(),
    fecha: String(formData.get("fecha") ?? ""),
    forma: String(formData.get("forma") ?? ""),
    referencia: String(formData.get("referencia") ?? "").trim(),
    nota: String(formData.get("nota") ?? "").trim(),
  };
  const comprobante = formData.get("comprobante");
  const hayArchivo = comprobante instanceof File && comprobante.size > 0;
  const base = { valores, archivo: hayArchivo ? comprobante.name : undefined };

  const porLinea = tipo === "pago_proveedor" || tipo === "devolucion_proveedor";
  const quoteId = porLinea ? await cotizacionDeLinea(ref) : esUuid(ref) ? ref : null;
  if (!quoteId) return { error: porLinea ? LINEA_NO_EXISTE : NO_EXISTE, ...base };

  const fecha = await hoyFn();
  const d = esquemaMovimiento(fecha).safeParse(valores);
  const errores: Partial<Record<CampoMovimiento, string>> = {};
  if (!d.success) for (const i of d.error.issues) errores[i.path[0] as CampoMovimiento] ??= i.message;
  if (hayArchivo && comprobante.size > MAX_COMPROBANTE) errores.comprobante = "El comprobante pesa más de 10 MB.";
  if (!d.success || errores.comprobante) return { errores, ...base };

  // El archivo se guarda antes de la transacción (no se procesa una imagen con la cotización bloqueada)
  // y se borra si la transacción no escribe nada.
  let archivo: { fileKey: string; mime: string } | null = null;
  if (hayArchivo) {
    try {
      archivo = await guardarComprobante(quoteId, randomUUID(), Buffer.from(await comprobante.arrayBuffer()));
    } catch (e) {
      if (e instanceof ErrorArchivo) return { errores: { comprobante: e.message }, ...base };
      console.error(e);
      return { error: "No se pudo guardar el comprobante. Intenta de nuevo.", ...base };
    }
  }

  let r: Awaited<ReturnType<typeof escribirMovimiento>>;
  try {
    r = await transaccion((tx) => escribirMovimiento(tx, tipo, quoteId, porLinea ? ref : null, d.data, archivo, yo.id));
  } catch (e) {
    await borrarArchivos(archivo?.fileKey ?? null);
    throw e;
  }
  if (typeof r === "string") {
    await borrarArchivos(archivo?.fileKey ?? null);
    return { error: r, ...base };
  }

  await audit({
    action: `saldo.${tipo}`,
    userId: yo.id,
    entity: "cotizacion",
    entityId: quoteId,
    meta: { movimiento: r.id, monto: d.data.monto, fecha: d.data.fecha, forma: d.data.forma, recibo: r.recibo, ...(porLinea ? { linea: ref, proveedor: r.proveedor } : {}) },
  });
  refresh();
  return { ok: r.recibo ? `${OK[tipo]} Recibo ${r.recibo}.` : OK[tipo] };
}

export async function registrarCobro(quoteId: string, _prev: EstadoMovimiento, formData: FormData): Promise<EstadoMovimiento> {
  return registrar("cobro", quoteId, formData);
}

export async function registrarDevolucion(quoteId: string, _prev: EstadoMovimiento, formData: FormData): Promise<EstadoMovimiento> {
  return registrar("devolucion", quoteId, formData);
}

export async function registrarPagoProveedor(itemId: string, _prev: EstadoMovimiento, formData: FormData): Promise<EstadoMovimiento> {
  return registrar("pago_proveedor", itemId, formData);
}

export async function registrarDevolucionProveedor(itemId: string, _prev: EstadoMovimiento, formData: FormData): Promise<EstadoMovimiento> {
  return registrar("devolucion_proveedor", itemId, formData);
}

/* ── Ajustes ────────────────────────────────────────────────── */

type CampoAjuste = "concepto" | "tipo" | "monto";
export type EstadoAjuste = { errores?: Partial<Record<CampoAjuste, string>>; error?: string; ok?: string; valores?: Partial<Record<CampoAjuste, string>> } | undefined;

const esquemaAjuste = z.object({
  concepto: z.string().trim().min(1, { error: "Escribe el concepto" }).max(120, { error: "Máximo 120 caracteres" }),
  tipo: z.enum(["cargo", "descuento"], { error: "Elige cargo o descuento" }),
  monto: z
    .string()
    .trim()
    .min(1, { error: "Escribe el monto" })
    .transform((v, ctx) => {
      const c = aCentavos(v);
      if (c === null || c <= 0) {
        ctx.addIssue({ code: "custom", message: "Monto no válido (ej.: 1.500 o 1.500,50)" });
        return z.NEVER;
      }
      return c;
    }),
});

/** Cargo o descuento sobre el total: la última cuota pendiente de la pareja absorbe la diferencia. */
export async function agregarAjuste(quoteId: string, _prev: EstadoAjuste, formData: FormData): Promise<EstadoAjuste> {
  const yo = await requireEquipo("saldos.crear");
  const valores = {
    concepto: String(formData.get("concepto") ?? "").trim(),
    tipo: String(formData.get("tipo") ?? ""),
    monto: String(formData.get("monto") ?? "").trim(),
  };
  if (!esUuid(quoteId)) return { error: NO_EXISTE, valores };
  const d = esquemaAjuste.safeParse(valores);
  if (!d.success) {
    const errores: Partial<Record<CampoAjuste, string>> = {};
    for (const i of d.error.issues) errores[i.path[0] as CampoAjuste] ??= i.message;
    return { errores, valores };
  }
  const monto = d.data.tipo === "descuento" ? -d.data.monto : d.data.monto;
  const fecha = await hoyFn();
  const r = await transaccion(async (tx) => {
    const c = await bloquear(tx, quoteId);
    if (!c) return NO_EXISTE;
    if (c.status === "cancelled") return CANCELADA;
    if (c.status !== "accepted") return NO_ACEPTADA;
    const [a] = await tx.insert(quoteAdjustments).values({ quoteId, concept: d.data.concepto, amountCents: monto, createdById: yo.id }).returning({ id: quoteAdjustments.id });
    return (await reajustarPlanPareja(tx, quoteId, fecha)) ?? { id: a.id };
  });
  if (typeof r === "string") return { error: r, valores };
  await audit({ action: "saldo.ajuste", userId: yo.id, entity: "cotizacion", entityId: quoteId, meta: { ajuste: r.id, concepto: d.data.concepto, monto } });
  refresh();
  return { ok: d.data.tipo === "descuento" ? "Descuento agregado." : "Cargo agregado." };
}

/* ── Anular ─────────────────────────────────────────────────── */

const motivoValido = z.string().trim().min(1, { error: "Escribe el motivo." }).max(200, { error: "El motivo admite hasta 200 caracteres." });

/** Anula un cobro, pago o devolución: queda visible y tachado con su motivo, y deja de contar. */
export async function anularMovimiento(id: string, motivo: string): Promise<string | void> {
  const yo = await requireEquipo("saldos.eliminar");
  if (!esUuid(id)) return "Este movimiento ya no existe.";
  const m = motivoValido.safeParse(motivo);
  if (!m.success) return m.error.issues[0].message;
  const [ref] = await db.select({ quoteId: paymentMovements.quoteId }).from(paymentMovements).where(eq(paymentMovements.id, id));
  if (!ref) return "Este movimiento ya no existe.";

  const r = await transaccion(async (tx) => {
    const c = await bloquear(tx, ref.quoteId);
    if (!c) return NO_EXISTE;
    if (c.status === "cancelled") return CANCELADA;
    if (c.status !== "accepted") return NO_ACEPTADA;
    const [mov] = await tx
      .update(paymentMovements)
      .set({ voidedAt: new Date(), voidedById: yo.id, voidReason: m.data })
      .where(and(eq(paymentMovements.id, id), sql`${paymentMovements.voidedAt} is null`))
      .returning();
    if (!mov) return "Este movimiento ya está anulado.";
    // Las sumas se revisan sin el anulado: nunca queda cobrado ni pagado de menos (o de más).
    if (mov.itemId === null) {
      const cobrado = await cobradoNeto(tx, c.id);
      if (cobrado < 0) return "No se puede anular: lo cobrado quedaría negativo. Anula antes la devolución.";
      if (cobrado > (await totalCotizacion(tx, c.id))) return "No se puede anular: lo cobrado superaría el total del evento.";
    } else {
      const pagado = await pagadoNetoLinea(tx, mov.itemId);
      const l = await lineaAceptada(tx, mov.itemId, c);
      if (pagado < 0) return "No se puede anular: lo pagado al proveedor quedaría negativo. Anula antes su devolución.";
      if (l && l.payer === "nova" && pagado > l.aPagar) return "No se puede anular: lo pagado superaría el monto a pagar al proveedor.";
    }
    return mov;
  });
  if (typeof r === "string") return r;
  await audit({
    action: "saldo.movimiento_anulado",
    userId: yo.id,
    entity: "cotizacion",
    entityId: r.quoteId,
    meta: { movimiento: id, tipo: r.kind, monto: r.amountCents, recibo: r.receiptCode, linea: r.itemId, motivo: m.data },
  });
  refresh();
}

/** Anula un ajuste: el total vuelve a cambiar y la última cuota pendiente absorbe la diferencia. */
export async function anularAjuste(id: string, motivo: string): Promise<string | void> {
  const yo = await requireEquipo("saldos.eliminar");
  if (!esUuid(id)) return "Este ajuste ya no existe.";
  const m = motivoValido.safeParse(motivo);
  if (!m.success) return m.error.issues[0].message;
  const [ref] = await db.select({ quoteId: quoteAdjustments.quoteId }).from(quoteAdjustments).where(eq(quoteAdjustments.id, id));
  if (!ref) return "Este ajuste ya no existe.";
  const fecha = await hoyFn();

  const r = await transaccion(async (tx) => {
    const c = await bloquear(tx, ref.quoteId);
    if (!c) return NO_EXISTE;
    if (c.status === "cancelled") return CANCELADA;
    if (c.status !== "accepted") return NO_ACEPTADA;
    const [a] = await tx
      .update(quoteAdjustments)
      .set({ voidedAt: new Date(), voidedById: yo.id, voidReason: m.data })
      .where(and(eq(quoteAdjustments.id, id), sql`${quoteAdjustments.voidedAt} is null`))
      .returning();
    if (!a) return "Este ajuste ya está anulado.";
    return (await reajustarPlanPareja(tx, c.id, fecha)) ?? a;
  });
  if (typeof r === "string") return r;
  await audit({ action: "saldo.ajuste_anulado", userId: yo.id, entity: "cotizacion", entityId: r.quoteId, meta: { ajuste: id, concepto: r.concept, monto: r.amountCents, motivo: m.data } });
  refresh();
}

/* ── Líneas de proveedor ────────────────────────────────────── */

/** Quién paga la línea: Nova Event (la cobra a la pareja y paga al proveedor) o la pareja directo. Cambia el total. */
export async function cambiarQuienPaga(itemId: string, payer: "nova" | "client"): Promise<string | void> {
  const yo = await requireEquipo("saldos.editar");
  if (!z.enum(["nova", "client"]).safeParse(payer).success) return "Elige quién paga.";
  const quoteId = await cotizacionDeLinea(itemId);
  if (!quoteId) return LINEA_NO_EXISTE;
  const fecha = await hoyFn();

  const r = await transaccion(async (tx) => {
    const c = await bloquear(tx, quoteId);
    if (!c) return NO_EXISTE;
    if (c.status === "cancelled") return CANCELADA;
    if (c.status !== "accepted") return NO_ACEPTADA;
    const l = await lineaAceptada(tx, itemId, c);
    if (!l) return LINEA_NO_EXISTE;
    if (l.payer === payer) return { cambio: false, proveedor: l.proveedor };
    if (payer === "client") {
      if (await tieneMovimientos(tx, { itemId })) return MENSAJE_PAGOS_PROVEEDOR;
      await borrarPlanes(tx, { itemId });
    }
    await tx.update(quoteItems).set({ payer }).where(eq(quoteItems.id, itemId));
    if (payer === "nova" && l.confirmation === "confirmed") await crearPlanProveedor(tx, itemId, fecha);
    return (await reajustarPlanPareja(tx, quoteId, fecha)) ?? { cambio: true, proveedor: l.proveedor };
  });
  if (typeof r === "string") return r;
  if (!r.cambio) return;
  await audit({ action: "saldo.quien_paga", userId: yo.id, entity: "cotizacion", entityId: quoteId, meta: { linea: itemId, proveedor: r.proveedor, paga: payer } });
  refresh();
}

/** Monto a pagar al proveedor en este evento (la pareja no lo ve). La última cuota pendiente del proveedor absorbe la diferencia. */
export async function cambiarMontoProveedor(itemId: string, monto: string): Promise<string | void> {
  const yo = await requireEquipo("saldos.editar");
  const centavos = aCentavos(String(monto ?? ""));
  if (centavos === null || centavos <= 0) return "Monto no válido (ej.: 1.500 o 1.500,50).";
  const quoteId = await cotizacionDeLinea(itemId);
  if (!quoteId) return LINEA_NO_EXISTE;
  const fecha = await hoyFn();

  const r = await transaccion(async (tx) => {
    const c = await bloquear(tx, quoteId);
    if (!c) return NO_EXISTE;
    if (c.status === "cancelled") return CANCELADA;
    if (c.status !== "accepted") return NO_ACEPTADA;
    const l = await lineaAceptada(tx, itemId, c);
    if (!l) return LINEA_NO_EXISTE;
    if (l.payer !== "nova") return "Esta línea la paga la pareja directo al proveedor.";
    const pagado = await pagadoNetoLinea(tx, itemId);
    if (centavos < pagado) return `No puede quedar por debajo de lo ya pagado (${formatoBs(pagado)}).`;
    await tx.update(quoteItems).set({ payableCents: centavos }).where(eq(quoteItems.id, itemId));
    return (await reajustarPlanProveedor(tx, itemId, fecha)) ?? { de: l.aPagar, proveedor: l.proveedor };
  });
  if (typeof r === "string") return r;
  await audit({ action: "saldo.monto_proveedor", userId: yo.id, entity: "cotizacion", entityId: quoteId, meta: { linea: itemId, proveedor: r.proveedor, de: r.de, a: centavos } });
  refresh();
}
