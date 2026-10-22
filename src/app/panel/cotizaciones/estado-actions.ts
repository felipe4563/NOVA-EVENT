"use server";

import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MENSAJE_PAGOS_PROVEEDOR, type Tx, bloquear, borrarPlanes, crearPlanPareja, crearPlanProveedor, tieneMovimientos } from "@/app/panel/saldos/planes";
import { db } from "@/db";
import { novaPackages, quoteAdjustments, quoteItems, quoteVersions, quotes, supplierBusy, supplierPackages, suppliers } from "@/db/schema";
import { audit, requireEquipo } from "@/lib/auth";
import { type Confirmacion, type EstadoManual, detalleEvento, estadosPermitidos, sePuedeAceptar } from "@/lib/cotizacion/aceptacion";
import { hoy } from "@/lib/fechas";
import { type NovaCongelado, congelarLinea, leerLineaCongelada, listaIncluye } from "@/lib/cotizacion/propuesta";

/** Token largo y aleatorio del enlace público (32 caracteres); nunca el id interno. */
const nuevoToken = () => randomBytes(24).toString("base64url");

const NO_EXISTE = "Esta cotización ya no existe.";

/*
 * Enlace público. Se permite también con la cotización aceptada:
 * compartir la propuesta aceptada es válido (solo muestra la versión aceptada).
 */

/** Activa el enlace (crea el token si aún no hay). Una cotización en borrador pasa a Enviada. */
export async function activarEnlace(quoteId: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  if (!z.uuid().safeParse(quoteId).success) return NO_EXISTE;
  const r = await db.transaction(async (tx) => {
    const [c] = await tx.select({ status: quotes.status, shareToken: quotes.shareToken }).from(quotes).where(eq(quotes.id, quoteId)).for("update");
    if (!c) return null;
    const enviada = c.status === "draft";
    await tx
      .update(quotes)
      .set({ shareToken: c.shareToken ?? nuevoToken(), shareEnabled: true, ...(enviada ? { status: "sent" as const } : {}) })
      .where(eq(quotes.id, quoteId));
    return { enviada, nuevo: !c.shareToken };
  });
  if (!r) return NO_EXISTE;
  await audit({ action: "cotizacion.enlace.activado", userId: yo.id, entity: "cotizacion", entityId: quoteId, meta: r });
  refresh();
}

/** Desactiva el enlace: la página y sus archivos dejan de abrirse (el token se guarda por si se vuelve a activar). */
export async function desactivarEnlace(quoteId: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  if (!z.uuid().safeParse(quoteId).success) return NO_EXISTE;
  const [c] = await db.update(quotes).set({ shareEnabled: false }).where(eq(quotes.id, quoteId)).returning({ id: quotes.id });
  if (!c) return NO_EXISTE;
  await audit({ action: "cotizacion.enlace.desactivado", userId: yo.id, entity: "cotizacion", entityId: quoteId });
  refresh();
}

/** Cambia el token (el enlace anterior deja de funcionar); el enlace queda como estaba (activo o no). */
export async function regenerarEnlace(quoteId: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  if (!z.uuid().safeParse(quoteId).success) return NO_EXISTE;
  const [c] = await db.update(quotes).set({ shareToken: nuevoToken() }).where(eq(quotes.id, quoteId)).returning({ id: quotes.id });
  if (!c) return NO_EXISTE;
  await audit({ action: "cotizacion.enlace.regenerado", userId: yo.id, entity: "cotizacion", entityId: quoteId });
  refresh();
}

/* ── Estados, aceptación y confirmación de proveedores ───────────── */

const esUuid = (v: string) => z.uuid().safeParse(v).success;
const CANCELADA = "Una cotización cancelada no cambia de estado: queda como registro.";
const ACEPTADA = "La cotización está aceptada: reábrela para cambiarla.";
const LINEA_NO_EXISTE = "Esta línea ya no existe.";
const CON_MOVIMIENTOS = "Esta cotización tiene cobros o pagos registrados. Usa “Cambiar fecha” o “Cancelar” en Saldos, o anula esos movimientos.";

/** Cualquier movimiento (también anulado: su recibo no se pierde y las FK son restrict) o ajuste vigente impide reabrir o eliminar. */
async function tieneRegistroPagos(tx: Tx, quoteId: string) {
  if (await tieneMovimientos(tx, { quoteId }, { incluirAnulados: true })) return true;
  const [a] = await tx.select({ id: quoteAdjustments.id }).from(quoteAdjustments).where(and(eq(quoteAdjustments.quoteId, quoteId), isNull(quoteAdjustments.voidedAt))).limit(1);
  return !!a;
}

/** Cambia el estado a mano (Enviada, Rechazada o Borrador). Una aceptada solo se reabre. */
export async function marcarEstado(quoteId: string, estado: EstadoManual): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  if (!esUuid(quoteId)) return NO_EXISTE;
  if (!z.enum(["sent", "rejected", "draft"]).safeParse(estado).success) return "Ese estado no es válido.";
  const r = await db.transaction(async (tx) => {
    const c = await bloquear(tx, quoteId);
    if (!c) return NO_EXISTE;
    if (c.status === "cancelled") return CANCELADA;
    if (!estadosPermitidos(c.status).includes(estado)) return c.status === "accepted" ? ACEPTADA : null;
    await tx.update(quotes).set({ status: estado }).where(eq(quotes.id, quoteId));
    return { de: c.status };
  });
  if (typeof r === "string") return r;
  if (!r) return; // ya estaba en ese estado
  await audit({ action: "cotizacion.estado", userId: yo.id, entity: "cotizacion", entityId: quoteId, meta: { de: r.de, a: estado } });
  refresh();
}

/**
 * Acepta una versión: la cotización se congela (copia del paquete Nova y de cada línea, tal como están hoy,
 * para que editar catálogos o borrar proveedores no la cambie) y cada proveedor queda «Por confirmar».
 * Las demás versiones se conservan (archivadas, de solo lectura).
 */
export async function aceptarVersion(quoteId: string, versionId: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  if (!esUuid(quoteId)) return NO_EXISTE;
  if (!esUuid(versionId)) return "Esa versión ya no existe.";
  const fechaHoy = await hoy();
  const r = await db.transaction(async (tx) => {
    const c = await bloquear(tx, quoteId);
    if (!c) return NO_EXISTE;
    if (c.status === "accepted") return "Esta cotización ya está aceptada.";
    if (c.status === "cancelled") return CANCELADA;
    if (!sePuedeAceptar(c.status)) return "Una cotización rechazada no se puede aceptar: vuélvela a borrador primero.";
    const [v] = await tx.select().from(quoteVersions).where(and(eq(quoteVersions.id, versionId), eq(quoteVersions.quoteId, quoteId)));
    if (!v) return "Esa versión ya no existe.";

    const lineas = await tx.select().from(quoteItems).where(eq(quoteItems.versionId, v.id));
    const idsProv = [...new Set(lineas.flatMap((l) => (l.supplierId ? [l.supplierId] : [])))];
    const idsPaq = [...new Set(lineas.flatMap((l) => (l.supplierPackageId ? [l.supplierPackageId] : [])))];
    const [provs, paqs] = await Promise.all([
      idsProv.length ? tx.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(inArray(suppliers.id, idsProv)) : [],
      idsPaq.length ? tx.select({ id: supplierPackages.id, name: supplierPackages.name }).from(supplierPackages).where(inArray(supplierPackages.id, idsPaq)) : [],
    ]);
    const nombreProv = new Map(provs.map((p) => [p.id, p.name]));
    const nombrePaq = new Map(paqs.map((p) => [p.id, p.name]));

    // Paquete Nova: lo mismo que muestra la propuesta (precio ajustado o de lista, «Incluye» con el paquete base).
    let nova: NovaCongelado | null = null;
    if (v.novaPackageId) {
      const [p] = await tx.select().from(novaPackages).where(eq(novaPackages.id, v.novaPackageId));
      if (p) {
        const [base] = p.basePackageId ? await tx.select({ name: novaPackages.name }).from(novaPackages).where(eq(novaPackages.id, p.basePackageId)) : [];
        nova = { nombre: p.name, precio: v.novaPriceCents ?? p.priceCents, frase: p.tagline, incluye: listaIncluye(base?.name ?? null, p.includes) };
      } else {
        // El paquete se borró a la vez: se congela con lo que guarda la versión, así la aceptada nunca cae a datos vivos.
        nova = { nombre: "Paquete Nova Event", precio: v.novaPriceCents ?? 0, frase: null, incluye: [] };
      }
    }
    await tx.update(quoteVersions).set({ frozen: nova }).where(eq(quoteVersions.id, v.id));
    for (const l of lineas) {
      const proveedor = l.supplierId ? (nombreProv.get(l.supplierId) ?? null) : null;
      const paquete = l.supplierPackageId ? (nombrePaq.get(l.supplierPackageId) ?? null) : null;
      await tx
        .update(quoteItems)
        .set({
          frozen: congelarLinea({ proveedor, paquete, etiqueta: l.label, total: l.totalCents }),
          // Solo las líneas con proveedor se confirman; las libres no.
          confirmation: l.supplierId ? "pending" : null,
          busyId: null,
        })
        .where(eq(quoteItems.id, l.id));
    }
    await tx.update(quotes).set({ status: "accepted", acceptedVersionId: v.id, acceptedAt: new Date() }).where(eq(quotes.id, quoteId));
    await crearPlanPareja(tx, quoteId, fechaHoy);
    return { de: c.status, version: v.name, proveedores: idsProv.length };
  });
  if (typeof r === "string") return r;
  await audit({ action: "cotizacion.aceptada", userId: yo.id, entity: "cotizacion", entityId: quoteId, meta: { version: versionId, nombre: r.version, de: r.de, proveedores: r.proveedores } });
  refresh();
}

type LineaAceptada = {
  id: string;
  supplierId: string | null;
  confirmation: Confirmacion | null;
  busyId: string | null;
  proveedor: string | null;
  quoteId: string;
  code: string;
  clientName: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
};

/**
 * Escritura sobre una línea de la versión aceptada, con la cotización bloqueada.
 * Rechaza si la línea no existe, si la cotización no está aceptada o si la línea no es de la versión aceptada con proveedor.
 * `fn` devuelve un texto para rechazar (sin escribir nada más).
 */
async function enLineaAceptada<T>(itemId: string, fn: (tx: Tx, l: LineaAceptada) => Promise<T | string>): Promise<{ valor: T; linea: LineaAceptada } | string> {
  if (!esUuid(itemId)) return LINEA_NO_EXISTE;
  return db.transaction(async (tx) => {
    // 1) De qué cotización es la línea; 2) se bloquea la cotización; 3) se vuelve a leer la línea (bloqueándola)
    // en otra sentencia: en READ COMMITTED ve lo que confirmó quien tenía el bloqueo antes (nada de copias viejas
    // que dejen días ocupados huérfanos). Siempre cotización → línea, el mismo orden que el resto: sin interbloqueos.
    const [ref] = await tx
      .select({ quoteId: quoteVersions.quoteId })
      .from(quoteItems)
      .innerJoin(quoteVersions, eq(quoteItems.versionId, quoteVersions.id))
      .where(eq(quoteItems.id, itemId));
    if (!ref) return LINEA_NO_EXISTE;
    const c = await bloquear(tx, ref.quoteId);
    if (!c) return LINEA_NO_EXISTE;
    const [f] = await tx
      .select({
        id: quoteItems.id,
        versionId: quoteItems.versionId,
        supplierId: quoteItems.supplierId,
        confirmation: quoteItems.confirmation,
        busyId: quoteItems.busyId,
        frozen: quoteItems.frozen,
      })
      .from(quoteItems)
      .innerJoin(quoteVersions, eq(quoteItems.versionId, quoteVersions.id))
      .where(and(eq(quoteItems.id, itemId), eq(quoteVersions.quoteId, c.id)))
      .for("update", { of: quoteItems });
    if (!f) return LINEA_NO_EXISTE;
    if (c.status !== "accepted") return "La cotización ya no está aceptada.";
    if (f.versionId !== c.acceptedVersionId || f.confirmation === null) return "Esta línea no tiene proveedor por confirmar.";
    const linea: LineaAceptada = {
      ...f,
      proveedor: leerLineaCongelada(f.frozen)?.proveedor ?? null,
      quoteId: c.id,
      code: c.code,
      clientName: c.clientName,
      eventDate: c.eventDate,
      startTime: c.startTime,
      endTime: c.endTime,
    };
    const valor = await fn(tx, linea);
    return typeof valor === "string" ? valor : { valor, linea };
  });
}

/** Quita el día ocupado que creó la confirmación de una línea (si lo tiene). */
async function liberar(tx: Tx, busyId: string | null) {
  if (busyId) await tx.delete(supplierBusy).where(eq(supplierBusy.id, busyId));
}

/**
 * Confirma al proveedor: crea su día ocupado en la fecha del evento (con el horario del evento, o todo el día),
 * registrado por Nova Event, y lo vincula a la línea para poder quitarlo después.
 */
export async function confirmarLinea(itemId: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  const fechaHoy = await hoy();
  const r = await enLineaAceptada(itemId, async (tx, l) => {
    if (l.confirmation === "confirmed") return "Este proveedor ya está confirmado.";
    if (!l.supplierId) return "El proveedor de esta línea ya no existe: no se puede reservar su día.";
    await liberar(tx, l.busyId);
    const [b] = await tx
      .insert(supplierBusy)
      .values({
        supplierId: l.supplierId,
        date: l.eventDate,
        startTime: l.startTime,
        endTime: l.endTime,
        detail: detalleEvento(l.clientName, l.code),
        byStaff: true,
        createdById: yo.id,
      })
      .returning({ id: supplierBusy.id });
    await tx.update(quoteItems).set({ confirmation: "confirmed", busyId: b.id }).where(eq(quoteItems.id, l.id));
    await crearPlanProveedor(tx, l.id, fechaHoy); // solo si paga Nova; no hace nada si ya tiene cuotas
    return { ocupado: b.id };
  });
  if (typeof r === "string") return r;
  await audit({
    action: "cotizacion.linea.confirmada",
    userId: yo.id,
    entity: "cotizacion",
    entityId: r.linea.quoteId,
    meta: { linea: itemId, proveedor: r.linea.proveedor, fecha: r.linea.eventDate, ocupado: r.valor.ocupado },
  });
  refresh();
}

/** El proveedor no puede: la línea queda marcada para reemplazarla (reabriendo la cotización). */
export async function marcarNoDisponible(itemId: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  const r = await enLineaAceptada(itemId, async (tx, l) => {
    if (l.confirmation === "unavailable") return "Este proveedor ya está marcado como no disponible.";
    if (await tieneMovimientos(tx, { itemId: l.id })) return MENSAJE_PAGOS_PROVEEDOR;
    await borrarPlanes(tx, { itemId: l.id });
    await liberar(tx, l.busyId);
    await tx.update(quoteItems).set({ confirmation: "unavailable", busyId: null }).where(eq(quoteItems.id, l.id));
    return { de: l.confirmation };
  });
  if (typeof r === "string") return r;
  await audit({ action: "cotizacion.linea.no_disponible", userId: yo.id, entity: "cotizacion", entityId: r.linea.quoteId, meta: { linea: itemId, proveedor: r.linea.proveedor, de: r.valor.de } });
  refresh();
}

/** Deshace la confirmación (o el «no disponible»): vuelve a «Por confirmar» y libera su día ocupado. */
export async function desconfirmarLinea(itemId: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  const r = await enLineaAceptada(itemId, async (tx, l) => {
    if (l.confirmation === "pending") return "Este proveedor ya está por confirmar.";
    if (await tieneMovimientos(tx, { itemId: l.id })) return MENSAJE_PAGOS_PROVEEDOR;
    await borrarPlanes(tx, { itemId: l.id });
    await liberar(tx, l.busyId);
    await tx.update(quoteItems).set({ confirmation: "pending", busyId: null }).where(eq(quoteItems.id, l.id));
    return { de: l.confirmation };
  });
  if (typeof r === "string") return r;
  await audit({ action: "cotizacion.linea.desconfirmada", userId: yo.id, entity: "cotizacion", entityId: r.linea.quoteId, meta: { linea: itemId, proveedor: r.linea.proveedor, de: r.valor.de } });
  refresh();
}

/** Reabre una aceptada: vuelve a Borrador, se descongela y se quitan los días ocupados que crearon sus confirmaciones. */
export async function reabrirCotizacion(quoteId: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  if (!esUuid(quoteId)) return NO_EXISTE;
  const r = await db.transaction(async (tx) => {
    const c = await bloquear(tx, quoteId);
    if (!c) return NO_EXISTE;
    if (c.status !== "accepted") return "Solo se reabre una cotización aceptada.";
    if (await tieneRegistroPagos(tx, quoteId)) return CON_MOVIMIENTOS;
    const versiones = tx.select({ id: quoteVersions.id }).from(quoteVersions).where(eq(quoteVersions.quoteId, quoteId));
    const ocupados = await tx
      .select({ busyId: quoteItems.busyId })
      .from(quoteItems)
      .where(and(inArray(quoteItems.versionId, versiones), isNotNull(quoteItems.busyId)));
    const ids = ocupados.flatMap((o) => (o.busyId ? [o.busyId] : []));
    if (ids.length) await tx.delete(supplierBusy).where(inArray(supplierBusy.id, ids));
    await borrarPlanes(tx, { quoteId });
    await tx.delete(quoteAdjustments).where(eq(quoteAdjustments.quoteId, quoteId)); // solo pueden quedar anulados
    await tx.update(quoteItems).set({ frozen: null, confirmation: null, busyId: null, payer: "nova", payableCents: null }).where(inArray(quoteItems.versionId, versiones));
    await tx.update(quoteVersions).set({ frozen: null }).where(eq(quoteVersions.quoteId, quoteId));
    await tx.update(quotes).set({ status: "draft", acceptedVersionId: null, acceptedAt: null }).where(eq(quotes.id, quoteId));
    return { version: c.acceptedVersionId, liberados: ids.length };
  });
  if (typeof r === "string") return r;
  await audit({ action: "cotizacion.reabierta", userId: yo.id, entity: "cotizacion", entityId: quoteId, meta: r });
  refresh();
}

/** Elimina la cotización con sus versiones y líneas. Una aceptada hay que reabrirla primero. */
export async function eliminarCotizacion(quoteId: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.eliminar");
  if (!esUuid(quoteId)) return NO_EXISTE;
  const r = await db.transaction(async (tx) => {
    const c = await bloquear(tx, quoteId);
    if (!c) return NO_EXISTE;
    if (c.status === "cancelled") return "Una cotización cancelada no se elimina: queda como registro.";
    if (c.status === "accepted") return "La cotización está aceptada. Reábrela primero para poder eliminarla.";
    if (await tieneRegistroPagos(tx, quoteId)) return CON_MOVIMIENTOS;
    await tx.delete(quoteAdjustments).where(eq(quoteAdjustments.quoteId, quoteId));
    await tx.delete(quotes).where(eq(quotes.id, quoteId));
    return { codigo: c.code, cliente: c.clientName, estado: c.status };
  });
  if (typeof r === "string") return r;
  await audit({ action: "cotizacion.eliminada", userId: yo.id, entity: "cotizacion", entityId: quoteId, meta: r });
  redirect("/panel/cotizaciones?ok=eliminada");
}
