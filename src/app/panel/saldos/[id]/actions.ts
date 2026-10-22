"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { paymentMovements, quoteAdjustments, quoteItems, quoteVersions } from "@/db/schema";
import { audit, requireEquipo } from "@/lib/auth";
import { aCentavos, formatoBs } from "@/lib/cotizacion/dinero";
import { hoy as hoyFn } from "@/lib/fechas";
import { permitidoEnCancelada } from "@/lib/saldos/movimiento";
import {
  CANCELADA,
  type CampoMovimiento,
  LINEA_NO_EXISTE,
  NO_ACEPTADA,
  NO_EXISTE,
  type TipoMovimiento,
  type ValoresMovimiento,
  conComprobante,
  escribirMovimiento,
  leerMovimiento,
  validarMovimiento,
} from "../movimientos";
import {
  MENSAJE_PAGOS_PROVEEDOR,
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
 * Movimientos de dinero de un evento. Todas siguen el mismo camino (ver ../movimientos.ts):
 * validar → (guardar el comprobante) → transacción: bloquear la cotización, revisar las reglas con sumas frescas, escribir
 * → auditoría → refresh(). Así dos envíos a la vez nunca superan el total: el segundo espera el bloqueo y ve el primero.
 */

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

export type EstadoMovimiento =
  | {
      errores?: Partial<Record<CampoMovimiento, string>>;
      error?: string;
      ok?: string;
      valores?: Partial<ValoresMovimiento>;
      /** Nombre del comprobante elegido: el campo de archivo no se puede volver a llenar solo. */
      archivo?: string;
    }
  | undefined;

type Tipo = TipoMovimiento;

const OK: Record<Tipo, string> = {
  cobro: "Cobro registrado.",
  devolucion: "Devolución registrada.",
  pago_proveedor: "Pago registrado.",
  devolucion_proveedor: "Devolución del proveedor registrada.",
};

async function registrar(tipo: Tipo, ref: string, formData: FormData): Promise<EstadoMovimiento> {
  const yo = await requireEquipo("saldos.crear");
  const { valores, comprobante } = leerMovimiento(formData);
  const base = { valores, archivo: comprobante?.name };

  const porLinea = tipo === "pago_proveedor" || tipo === "devolucion_proveedor";
  const quoteId = porLinea ? await cotizacionDeLinea(ref) : esUuid(ref) ? ref : null;
  if (!quoteId) return { error: porLinea ? LINEA_NO_EXISTE : NO_EXISTE, ...base };

  const v = validarMovimiento(valores, comprobante, await hoyFn());
  if ("errores" in v) return { errores: v.errores, ...base };
  const d = v.datos;

  const r = await conComprobante(quoteId, comprobante, (archivo) =>
    transaccion((tx) => escribirMovimiento(tx, tipo, quoteId, porLinea ? ref : null, d, archivo, yo.id)),
  );
  if ("errorComprobante" in r) return { errores: { comprobante: r.errorComprobante }, ...base };
  if ("error" in r) return { error: r.error, ...base };

  await audit({
    action: `saldo.${tipo}`,
    userId: yo.id,
    entity: "cotizacion",
    entityId: quoteId,
    meta: { movimiento: r.valor.id, monto: d.monto, fecha: d.fecha, forma: d.forma, recibo: r.valor.recibo, ...(porLinea ? { linea: ref, proveedor: r.valor.proveedor } : {}) },
  });
  refresh();
  return { ok: r.valor.recibo ? `${OK[tipo]} Recibo ${r.valor.recibo}.` : OK[tipo] };
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

/**
 * Anula un cobro, pago o devolución: queda visible y tachado con su motivo, y deja de contar.
 * En un evento cancelado solo se anulan devoluciones (para corregir una mal registrada), con las mismas revisiones.
 */
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
    if (c.status !== "accepted" && c.status !== "cancelled") return NO_ACEPTADA;
    const [mov] = await tx
      .update(paymentMovements)
      .set({ voidedAt: new Date(), voidedById: yo.id, voidReason: m.data })
      .where(and(eq(paymentMovements.id, id), sql`${paymentMovements.voidedAt} is null`))
      .returning();
    if (!mov) return "Este movimiento ya está anulado.";
    if (c.status === "cancelled" && !permitidoEnCancelada(mov.kind)) return CANCELADA;
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
