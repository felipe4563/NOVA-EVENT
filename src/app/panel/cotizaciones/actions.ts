"use server";

import { and, asc, eq, inArray, isNotNull, not, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { eventTypes, novaPackages, quoteItems, quoteVersions, quotes, supplierPackages, suppliers } from "@/db/schema";
import { audit, requireEquipo } from "@/lib/auth";
import { recalcularPorInvitados, totalLinea } from "@/lib/cotizacion/calculo";
import { MAX_CENTAVOS, aCentavos } from "@/lib/cotizacion/dinero";
import { codigoCotizacion } from "@/lib/cotizacion/propuesta";
import { RE_HORA, esFechaValida, hoy } from "@/lib/fechas";
import { equipoActivo } from "./datos";

type Campo = "cliente" | "telefono" | "email" | "tipo" | "fecha" | "inicio" | "fin" | "invitados" | "presupuesto" | "validez" | "notas" | "responsable";

export type EstadoCotizacion =
  | {
      errores?: Partial<Record<Campo, string>>;
      error?: string;
      ok?: string;
      valores?: Partial<Record<Campo, string>> & { incluirNova?: boolean; mostrarPresupuesto?: boolean };
    }
  | undefined;

const CAMPOS: Campo[] = ["cliente", "telefono", "email", "tipo", "fecha", "inicio", "fin", "invitados", "presupuesto", "validez", "notas", "responsable"];

function leer(f: FormData) {
  const v: Partial<Record<Campo, string>> & { incluirNova: boolean; mostrarPresupuesto: boolean } = {
    incluirNova: f.get("incluirNova") === "on",
    mostrarPresupuesto: f.get("mostrarPresupuesto") === "on",
  };
  for (const c of CAMPOS) v[c] = String(f.get(c) ?? "").trim();
  return v;
}

const esUuid = (v: string) => z.uuid().safeParse(v).success;

/** Una aceptada o cancelada ya no se modifica (la cancelada queda como registro). */
const ACEPTADA = "La cotización ya fue aceptada y no se puede modificar.";
const CANCELADA = "La cotización está cancelada: queda como registro y no se puede modificar.";

/** Un total por persona puede pasar lo que cabe en la base (integer): se rechaza sin escribir. */
const LINEA_GRANDE = "El total de la línea es demasiado grande";

const opcional = (max: number) => z.string().trim().max(max, { error: `Máximo ${max} caracteres` });

const esquema = z.object({
  cliente: z.string().trim().min(2, { error: "Escribe el nombre del cliente" }).max(120, { error: "Máximo 120 caracteres" }),
  telefono: opcional(40),
  email: z.union([z.literal(""), z.email({ error: "Escribe un correo válido" }).trim().toLowerCase().max(160)]),
  tipo: z.uuid({ error: "Elige el tipo de evento" }),
  fecha: z.string().refine(esFechaValida, { error: "Elige una fecha válida" }),
  inicio: z.string().refine((t) => t === "" || RE_HORA.test(t), { error: "Hora no válida" }),
  fin: z.string().refine((t) => t === "" || RE_HORA.test(t), { error: "Hora no válida" }),
  invitados: z.string().refine((t) => /^\d{1,4}$/.test(t) && Number(t) >= 1 && Number(t) <= 5000, { error: "Escribe un número de invitados entre 1 y 5000" }),
  presupuesto: z.string().refine((t) => t === "" || aCentavos(t) !== null, { error: "Escribe un monto válido, por ejemplo 15.000 o 15000,50" }),
  validez: z.string().refine((t) => t === "" || esFechaValida(t), { error: "Elige una fecha válida" }),
  notas: opcional(2000),
  responsable: z.string(),
});

function erroresDe(e: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

/** Reglas que dependen de otros campos o de la base. Devuelve los errores por campo. */
async function validar(valores: ReturnType<typeof leer>, validezActual: string | null) {
  const datos = esquema.safeParse(valores);
  const errores: Partial<Record<Campo, string>> = datos.success ? {} : erroresDe(datos.error);
  const d = datos.success ? datos.data : null;

  if (!errores.inicio && !errores.fin) {
    if (!!valores.inicio !== !!valores.fin) errores.fin = "Completa la hora de inicio y la de fin, o deja las dos vacías";
    else if (valores.inicio && valores.fin && valores.fin <= valores.inicio) errores.fin = "La hora de fin debe ser después de la de inicio";
  }
  // Una validez ya vencida solo se tolera si no se cambió (al editar otros datos).
  if (!errores.validez && valores.validez && valores.validez !== validezActual && valores.validez < (await hoy())) {
    errores.validez = "La validez no puede estar en el pasado";
  }
  if (d) {
    const [tipo] = await db.select({ id: eventTypes.id }).from(eventTypes).where(eq(eventTypes.id, d.tipo));
    if (!tipo) errores.tipo = "Ese tipo de evento ya no existe";
  }
  return { datos: d, errores };
}

async function responsableValido(id: string) {
  return (await equipoActivo()).some((u) => u.id === id);
}

/** Columnas de la cotización que vienen del formulario. */
function aFila(d: z.infer<typeof esquema>, v: ReturnType<typeof leer>) {
  const n = (s: string) => s || null;
  return {
    clientName: d.cliente,
    clientPhone: n(d.telefono),
    clientEmail: n(d.email),
    eventTypeId: d.tipo,
    eventDate: d.fecha,
    startTime: n(d.inicio),
    endTime: n(d.fin),
    guests: Number(d.invitados),
    budgetCents: d.presupuesto ? aCentavos(d.presupuesto) : null,
    includeNovaInBudget: v.incluirNova,
    showBudgetToClient: v.mostrarPresupuesto,
    validUntil: n(d.validez),
    notes: n(d.notas),
  };
}

function esChoqueUnico(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

export async function crearCotizacion(_prev: EstadoCotizacion, formData: FormData): Promise<EstadoCotizacion> {
  const yo = await requireEquipo("cotizaciones.crear");
  const valores = leer(formData);
  const { datos, errores } = await validar(valores, null);
  const ownerId = valores.responsable || yo.id;
  if (datos && !(await responsableValido(ownerId))) errores.responsable = "Elige a una persona activa del equipo";
  if (!datos || Object.keys(errores).length) return { errores, valores };

  // El año del código es el de hoy (creación), no el del evento.
  const anio = Number((await hoy()).slice(0, 4));
  const fila = { ...aFila(datos, valores), ownerId, createdById: yo.id };

  // Correlativo: max(seq)+1 del año; si dos personas chocan, el unique obliga a reintentar.
  let creada: { id: string; code: string } | null = null;
  for (let intento = 0; intento < 5 && !creada; intento++) {
    try {
      creada = await db.transaction(async (tx) => {
        const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${quotes.seq}), 0)` }).from(quotes).where(eq(quotes.year, anio));
        const seq = Number(max) + 1;
        const [nueva] = await tx
          .insert(quotes)
          .values({ ...fila, year: anio, seq, code: codigoCotizacion(anio, seq) })
          .returning({ id: quotes.id, code: quotes.code });
        await tx.insert(quoteVersions).values({ quoteId: nueva.id, name: "Opción 1", sortOrder: 0 });
        return nueva;
      });
    } catch (e) {
      if (!esChoqueUnico(e)) throw e;
    }
  }
  if (!creada) return { error: "No se pudo asignar el número de cotización. Inténtalo de nuevo.", valores };

  await audit({ action: "cotizacion.creada", userId: yo.id, entity: "cotizacion", entityId: creada.id, meta: { codigo: creada.code, cliente: datos.cliente } });
  redirect(`/panel/cotizaciones/${creada.id}`);
}

export async function actualizarDatos(id: string, _prev: EstadoCotizacion, formData: FormData): Promise<EstadoCotizacion> {
  const yo = await requireEquipo("cotizaciones.editar");
  const valores = leer(formData);
  if (!esUuid(id)) return { error: "Esta cotización ya no existe.", valores };
  const [actual] = await db
    .select({ status: quotes.status, guests: quotes.guests, validUntil: quotes.validUntil, ownerId: quotes.ownerId })
    .from(quotes)
    .where(eq(quotes.id, id));
  if (!actual) return { error: "Esta cotización ya no existe.", valores };
  if (actual.status === "accepted") return { error: ACEPTADA, valores };
  if (actual.status === "cancelled") return { error: CANCELADA, valores };

  const { datos, errores } = await validar(valores, actual.validUntil);
  const ownerId = valores.responsable || actual.ownerId; // vacío = sin cambio
  // Si el responsable no cambió se respeta aunque ya no esté activo.
  if (datos && ownerId && ownerId !== actual.ownerId && !(await responsableValido(ownerId))) errores.responsable = "Elige a una persona activa del equipo";
  if (!datos || Object.keys(errores).length) return { errores, valores };

  const invitados = Number(datos.invitados);
  // Con la cotización bloqueada: primero se calculan las líneas y, si alguna no cabe, no se escribe nada.
  const r = await db.transaction(async (tx) => {
    const [f] = await tx.select({ status: quotes.status, guests: quotes.guests }).from(quotes).where(eq(quotes.id, id)).for("update");
    if (!f || f.status === "accepted" || f.status === "cancelled") return "no";
    const cambioInvitados = invitados !== f.guests;
    let cambios: { id: string; total: number }[] = [];
    if (cambioInvitados) {
      // Las líneas por persona (no editadas a mano) siguen a los invitados, en todas las versiones.
      const versiones = await tx.select({ id: quoteVersions.id }).from(quoteVersions).where(eq(quoteVersions.quoteId, id));
      const lineas = versiones.length
        ? await tx
            .select()
            .from(quoteItems)
            .where(inArray(quoteItems.versionId, versiones.map((v) => v.id)))
        : [];
      const nuevas = recalcularPorInvitados(
        lineas.map((l) => ({ ...l, modo: l.pricing, precioUnitario: l.unitCents, manual: l.manualPrice, total: l.totalCents })),
        invitados,
      );
      cambios = nuevas.filter((l, i) => l.total !== lineas[i].totalCents).map((l) => ({ id: l.id, total: l.total }));
      if (cambios.some((l) => l.total > MAX_CENTAVOS)) return "grande";
    }
    await tx
      .update(quotes)
      .set({ ...aFila(datos, valores), ownerId })
      .where(eq(quotes.id, id));
    for (const l of cambios) await tx.update(quoteItems).set({ totalCents: l.total }).where(eq(quoteItems.id, l.id));
    return { cambioInvitados };
  });
  if (r === "no") return { error: "Esta cotización ya no existe, o fue aceptada o cancelada, y no se puede modificar.", valores };
  if (r === "grande") return { errores: { invitados: `${LINEA_GRANDE} con estos invitados.` }, valores };
  const { cambioInvitados } = r;

  await audit({ action: "cotizacion.datos", userId: yo.id, entity: "cotizacion", entityId: id, meta: cambioInvitados ? { invitados } : undefined });
  refresh();
  return { ok: "Datos guardados.", valores };
}

/* ── Armado: versiones y líneas ───────────────────────────────── */

export type EstadoArmado =
  | {
      errores?: Partial<Record<"nombre" | "precio" | "etiqueta", string>>;
      error?: string;
      ok?: string;
      valores?: Record<string, string>;
    }
  | undefined;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Contexto = { quoteId: string; guests: number };
type Resultado<T> = { ok: true; valor: T; quoteId: string } | { ok: false; error: string };


/**
 * Ejecuta una escritura con la fila de la cotización bloqueada (FOR UPDATE),
 * así nadie la acepta a la vez. Rechaza si no existe, si la versión o línea no es suya, o si ya está aceptada o cancelada.
 */
async function enCotizacion<T>(
  donde: { quoteId: string } | { versionId: string } | { itemId: string },
  fn: (tx: Tx, c: Contexto) => Promise<T>,
): Promise<Resultado<T>> {
  const id = "quoteId" in donde ? donde.quoteId : "versionId" in donde ? donde.versionId : donde.itemId;
  const noExiste = "quoteId" in donde ? "Esta cotización ya no existe." : "versionId" in donde ? "Esta versión ya no existe." : "Esta línea ya no existe.";
  if (!esUuid(id)) return { ok: false, error: noExiste };
  return db.transaction(async (tx): Promise<Resultado<T>> => {
    const sel = { quoteId: quotes.id, status: quotes.status, guests: quotes.guests };
    const [f] =
      "quoteId" in donde
        ? await tx.select(sel).from(quotes).where(eq(quotes.id, id)).for("update")
        : "versionId" in donde
          ? await tx
              .select(sel)
              .from(quoteVersions)
              .innerJoin(quotes, eq(quoteVersions.quoteId, quotes.id))
              .where(eq(quoteVersions.id, id))
              .for("update", { of: quotes })
          : await tx
              .select(sel)
              .from(quoteItems)
              .innerJoin(quoteVersions, eq(quoteItems.versionId, quoteVersions.id))
              .innerJoin(quotes, eq(quoteVersions.quoteId, quotes.id))
              .where(eq(quoteItems.id, id))
              .for("update", { of: quotes });
    if (!f) return { ok: false, error: noExiste };
    if (f.status === "accepted") return { ok: false, error: ACEPTADA };
    if (f.status === "cancelled") return { ok: false, error: CANCELADA };
    const valor = await fn(tx, { quoteId: f.quoteId, guests: f.guests ?? 0 });
    return { ok: true, valor, quoteId: f.quoteId };
  });
}

/** "Opción N" con el primer N libre (desde la cantidad de versiones + 1) y el orden al final. */
async function nombreNuevaVersion(tx: Tx, quoteId: string) {
  const filas = await tx.select({ name: quoteVersions.name, o: quoteVersions.sortOrder }).from(quoteVersions).where(eq(quoteVersions.quoteId, quoteId));
  const usados = new Set(filas.map((f) => f.name));
  let n = filas.length + 1;
  while (usados.has(`Opción ${n}`)) n++;
  return { name: `Opción ${n}`, sortOrder: filas.reduce((m, f) => Math.max(m, f.o + 1), 0) };
}

export async function crearVersion(quoteId: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  const r = await enCotizacion({ quoteId }, async (tx, c) => {
    const [v] = await tx
      .insert(quoteVersions)
      .values({ quoteId: c.quoteId, ...(await nombreNuevaVersion(tx, c.quoteId)) })
      .returning({ id: quoteVersions.id, name: quoteVersions.name });
    return v;
  });
  if (!r.ok) return r.error;
  await audit({ action: "cotizacion.version.creada", userId: yo.id, entity: "cotizacion", entityId: r.quoteId, meta: { version: r.valor.id, nombre: r.valor.name } });
  redirect(`/panel/cotizaciones/${r.quoteId}?v=${r.valor.id}`);
}

export async function duplicarVersion(versionId: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  const r = await enCotizacion({ versionId }, async (tx, c) => {
    const [orig] = await tx.select().from(quoteVersions).where(eq(quoteVersions.id, versionId));
    if (!orig) return null;
    const [v] = await tx
      .insert(quoteVersions)
      .values({
        quoteId: c.quoteId,
        ...(await nombreNuevaVersion(tx, c.quoteId)),
        showInProposal: orig.showInProposal,
        novaPackageId: orig.novaPackageId,
        novaPriceCents: orig.novaPriceCents,
      })
      .returning({ id: quoteVersions.id, name: quoteVersions.name });
    // Se copian las líneas, sin lo que pertenece a la aceptación (congelado, confirmación, día ocupado).
    const lineas = await tx.select().from(quoteItems).where(eq(quoteItems.versionId, versionId)).orderBy(asc(quoteItems.sortOrder));
    if (lineas.length) {
      await tx.insert(quoteItems).values(
        lineas.map((l) => ({
          versionId: v.id,
          categoryId: l.categoryId,
          supplierId: l.supplierId,
          supplierPackageId: l.supplierPackageId,
          label: l.label,
          pricing: l.pricing,
          unitCents: l.unitCents,
          totalCents: l.totalCents,
          manualPrice: l.manualPrice,
          sortOrder: l.sortOrder,
        })),
      );
    }
    return { ...v, de: orig.name };
  });
  if (!r.ok) return r.error;
  if (!r.valor) return "Esta versión ya no existe.";
  await audit({ action: "cotizacion.version.duplicada", userId: yo.id, entity: "cotizacion", entityId: r.quoteId, meta: { version: r.valor.id, nombre: r.valor.name, de: r.valor.de } });
  redirect(`/panel/cotizaciones/${r.quoteId}?v=${r.valor.id}`);
}

export async function renombrarVersion(versionId: string, _prev: EstadoArmado, formData: FormData): Promise<EstadoArmado> {
  const yo = await requireEquipo("cotizaciones.editar");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const valores = { nombre };
  if (nombre.length < 1 || nombre.length > 60) return { errores: { nombre: "Escribe un nombre de hasta 60 caracteres" }, valores };
  const r = await enCotizacion({ versionId }, (tx) => tx.update(quoteVersions).set({ name: nombre }).where(eq(quoteVersions.id, versionId)));
  if (!r.ok) return { error: r.error, valores };
  await audit({ action: "cotizacion.version.renombrada", userId: yo.id, entity: "cotizacion", entityId: r.quoteId, meta: { version: versionId, nombre } });
  refresh();
  return { ok: "Nombre guardado.", valores };
}

export async function eliminarVersion(versionId: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  const r = await enCotizacion({ versionId }, async (tx, c) => {
    const [{ total }] = await tx.select({ total: sql<number>`count(*)::int` }).from(quoteVersions).where(eq(quoteVersions.quoteId, c.quoteId));
    if (total <= 1) return null;
    const [b] = await tx.delete(quoteVersions).where(eq(quoteVersions.id, versionId)).returning({ name: quoteVersions.name });
    return b ? b.name : undefined;
  });
  if (!r.ok) return r.error;
  if (r.valor === null) return "No se puede eliminar la única versión de la cotización.";
  if (r.valor === undefined) return "Esta versión ya no existe.";
  await audit({ action: "cotizacion.version.eliminada", userId: yo.id, entity: "cotizacion", entityId: r.quoteId, meta: { version: versionId, nombre: r.valor } });
  redirect(`/panel/cotizaciones/${r.quoteId}`);
}

export async function alternarVisible(versionId: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  const r = await enCotizacion({ versionId }, async (tx) => {
    const [v] = await tx
      .update(quoteVersions)
      .set({ showInProposal: not(quoteVersions.showInProposal) })
      .where(eq(quoteVersions.id, versionId))
      .returning({ visible: quoteVersions.showInProposal });
    return v ? v.visible : null;
  });
  if (!r.ok) return r.error;
  if (r.valor === null) return "Esta versión ya no existe.";
  await audit({ action: "cotizacion.version.visible", userId: yo.id, entity: "cotizacion", entityId: r.quoteId, meta: { version: versionId, visible: r.valor } });
  refresh();
}

export async function elegirPaqueteNova(versionId: string, paqueteId: string | null): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  if (paqueteId !== null && !esUuid(paqueteId)) return "Ese paquete ya no existe.";
  const r = await enCotizacion({ versionId }, async (tx) => {
    if (paqueteId) {
      // Un paquete inactivo solo se acepta si la versión ya lo tenía.
      const [p] = await tx.select({ active: novaPackages.active }).from(novaPackages).where(eq(novaPackages.id, paqueteId));
      const [v] = await tx.select({ actual: quoteVersions.novaPackageId }).from(quoteVersions).where(eq(quoteVersions.id, versionId));
      if (!p || (!p.active && v?.actual !== paqueteId)) return false;
    }
    // Al cambiar de paquete se vuelve a su precio.
    await tx.update(quoteVersions).set({ novaPackageId: paqueteId, novaPriceCents: null }).where(eq(quoteVersions.id, versionId));
    return true;
  });
  if (!r.ok) return r.error;
  if (!r.valor) return "Ese paquete ya no está disponible.";
  await audit({ action: "cotizacion.nova", userId: yo.id, entity: "cotizacion", entityId: r.quoteId, meta: { version: versionId, paquete: paqueteId } });
  refresh();
}

/** Precio del paquete Nova en esta versión (descuento). Con "restablecer" vuelve al precio del paquete. */
export async function ajustarPrecioNova(versionId: string, _prev: EstadoArmado, formData: FormData): Promise<EstadoArmado> {
  const yo = await requireEquipo("cotizaciones.editar");
  const restablecer = formData.get("restablecer") === "1";
  const precio = String(formData.get("precio") ?? "").trim();
  const valores = { precio };
  const centavos = restablecer ? null : aCentavos(precio);
  if (!restablecer && centavos === null) return { errores: { precio: "Escribe un monto válido. Ej. 2.500 o 85,50" }, valores };
  const r = await enCotizacion({ versionId }, async (tx) => {
    const act = await tx
      .update(quoteVersions)
      .set({ novaPriceCents: centavos })
      .where(and(eq(quoteVersions.id, versionId), isNotNull(quoteVersions.novaPackageId)))
      .returning({ id: quoteVersions.id });
    return act.length > 0;
  });
  if (!r.ok) return { error: r.error, valores };
  if (!r.valor) return { error: "Elige primero un paquete de Nova Event.", valores };
  await audit({ action: "cotizacion.nova", userId: yo.id, entity: "cotizacion", entityId: r.quoteId, meta: { version: versionId, precio: centavos } });
  refresh();
  return { ok: restablecer ? "Se usa el precio del paquete." : "Precio guardado." };
}

/**
 * Agrega una línea a la versión. Con proveedor: el precio sale del paquete elegido (totalLinea)
 * o del monto manual. Sin proveedor (línea libre): etiqueta y monto obligatorios.
 */
export async function agregarLinea(versionId: string, _prev: EstadoArmado, formData: FormData): Promise<EstadoArmado> {
  const yo = await requireEquipo("cotizaciones.editar");
  const campo = (k: string) => String(formData.get(k) ?? "").trim();
  const valores = { categoria: campo("categoria"), proveedor: campo("proveedor"), paquete: campo("paquete"), etiqueta: campo("etiqueta"), precio: campo("precio") };
  const { categoria, proveedor, paquete, etiqueta, precio } = valores;
  const errores: NonNullable<NonNullable<EstadoArmado>["errores"]> = {};
  if (proveedor ? etiqueta.length > 120 : etiqueta.length < 2 || etiqueta.length > 120) {
    errores.etiqueta = proveedor ? "Máximo 120 caracteres" : "Escribe qué es (de 2 a 120 caracteres)";
  }
  const monto = paquete ? null : aCentavos(precio);
  if (!paquete && monto === null) errores.precio = "Escribe un monto válido. Ej. 2.500 o 85,50";
  if (Object.keys(errores).length) return { errores, valores };
  if ((categoria && !esUuid(categoria)) || (proveedor && (!esUuid(proveedor) || !categoria)) || (paquete && (!esUuid(paquete) || !proveedor))) {
    return { error: "Elige de nuevo: los datos de la línea no son válidos.", valores };
  }

  const r = await enCotizacion({ versionId }, async (tx, c) => {
    let fila: { label: string; pricing: "fixed" | "per_person"; unitCents: number };
    if (proveedor) {
      const [p] = await tx.select({ categoryId: suppliers.categoryId, active: suppliers.active }).from(suppliers).where(eq(suppliers.id, proveedor));
      if (!p || !p.active || p.categoryId !== categoria) return "Ese proveedor ya no está disponible en esta categoría.";
      if (paquete) {
        const [q] = await tx
          .select({ name: supplierPackages.name, priceCents: supplierPackages.priceCents, pricing: supplierPackages.pricing })
          .from(supplierPackages)
          .where(and(eq(supplierPackages.id, paquete), eq(supplierPackages.supplierId, proveedor), eq(supplierPackages.active, true)));
        if (!q) return "Ese paquete ya no está disponible.";
        fila = { label: q.name, pricing: q.pricing, unitCents: q.priceCents };
      } else {
        fila = { label: etiqueta || "Monto manual", pricing: "fixed", unitCents: monto! };
      }
    } else {
      fila = { label: etiqueta, pricing: "fixed", unitCents: monto! };
    }
    const total = totalLinea(fila.pricing, fila.unitCents, c.guests);
    if (total > MAX_CENTAVOS) return `${LINEA_GRANDE}: «${fila.label}» por ${c.guests} invitados.`;
    const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${quoteItems.sortOrder}), -1)::int` }).from(quoteItems).where(eq(quoteItems.versionId, versionId));
    const [nueva] = await tx
      .insert(quoteItems)
      .values({
        versionId,
        categoryId: categoria || null,
        supplierId: proveedor || null,
        supplierPackageId: paquete || null,
        ...fila,
        totalCents: total,
        sortOrder: max + 1,
      })
      .returning({ id: quoteItems.id });
    return { id: nueva.id, label: fila.label };
  });
  if (!r.ok) return { error: r.error, valores };
  if (typeof r.valor === "string") return { error: r.valor, valores };
  await audit({
    action: "cotizacion.linea.agregada",
    userId: yo.id,
    entity: "cotizacion",
    entityId: r.quoteId,
    meta: { version: versionId, linea: r.valor.id, proveedor: proveedor || null, etiqueta: r.valor.label },
  });
  refresh();
  return { ok: "Línea agregada." };
}

/**
 * Precio final de una línea (su total). Queda como "precio ajustado" y ya no sigue a los invitados.
 * Con "restablecer" vuelve al precio de lista: el actual del paquete si sigue existiendo y activo
 * (se relee), si no el que quedó guardado en la línea; siempre con totalLinea y los invitados actuales.
 */
export async function ajustarPrecioLinea(itemId: string, _prev: EstadoArmado, formData: FormData): Promise<EstadoArmado> {
  const yo = await requireEquipo("cotizaciones.editar");
  const restablecer = formData.get("restablecer") === "1";
  const precio = String(formData.get("precio") ?? "").trim();
  const valores = { precio };
  const centavos = restablecer ? null : aCentavos(precio);
  if (!restablecer && centavos === null) return { errores: { precio: "Escribe un monto válido. Ej. 2.500 o 85,50" }, valores };
  const r = await enCotizacion({ itemId }, async (tx, c) => {
    const [l] = await tx
      .select({ pricing: quoteItems.pricing, unitCents: quoteItems.unitCents, paquete: quoteItems.supplierPackageId })
      .from(quoteItems)
      .where(eq(quoteItems.id, itemId));
    if (!l) return "Esta línea ya no existe.";
    let cambios: { manualPrice: boolean; pricing?: "fixed" | "per_person"; unitCents?: number; totalCents: number };
    let delPaquete = false;
    if (centavos === null) {
      const [q] = l.paquete
        ? await tx
            .select({ priceCents: supplierPackages.priceCents, pricing: supplierPackages.pricing })
            .from(supplierPackages)
            .where(and(eq(supplierPackages.id, l.paquete), eq(supplierPackages.active, true)))
        : [];
      delPaquete = Boolean(q);
      const pricing = q?.pricing ?? l.pricing;
      const unitCents = q?.priceCents ?? l.unitCents;
      const total = totalLinea(pricing, unitCents, c.guests);
      if (total > MAX_CENTAVOS) return LINEA_GRANDE;
      cambios = { manualPrice: false, pricing, unitCents, totalCents: total };
    } else {
      // Un monto fijo sin paquete no tiene precio de lista: simplemente cambia su monto.
      cambios = l.pricing === "fixed" && !l.paquete ? { manualPrice: false, unitCents: centavos, totalCents: centavos } : { manualPrice: true, totalCents: centavos };
    }
    await tx.update(quoteItems).set(cambios).where(eq(quoteItems.id, itemId));
    return { total: cambios.totalCents, delPaquete };
  });
  if (!r.ok) return { error: r.error, valores };
  if (typeof r.valor === "string") return r.valor === LINEA_GRANDE ? { errores: { precio: `${LINEA_GRANDE}.` }, valores } : { error: r.valor, valores };
  await audit({
    action: "cotizacion.linea.precio",
    userId: yo.id,
    entity: "cotizacion",
    entityId: r.quoteId,
    meta: { linea: itemId, total: r.valor.total, restablecido: restablecer, ...(restablecer ? { delPaquete: r.valor.delPaquete } : {}) },
  });
  refresh();
  return { ok: !restablecer ? "Precio guardado." : r.valor.delPaquete ? "Se usa el precio actual del paquete." : "Se volvió al precio original." };
}

export async function quitarLinea(itemId: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  const r = await enCotizacion({ itemId }, async (tx) => {
    const [b] = await tx.delete(quoteItems).where(eq(quoteItems.id, itemId)).returning({ label: quoteItems.label });
    return b?.label ?? null;
  });
  if (!r.ok) return r.error;
  if (r.valor === null) return "Esta línea ya no existe.";
  await audit({ action: "cotizacion.linea.quitada", userId: yo.id, entity: "cotizacion", entityId: r.quoteId, meta: { linea: itemId, etiqueta: r.valor } });
  refresh();
}
