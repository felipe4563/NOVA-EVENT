import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { paymentInstallments, paymentMovements, quoteAdjustments, quoteItems, quoteVersions, quotes, suppliers } from "@/db/schema";
import { leerLineaCongelada, leerVersionCongelada } from "@/lib/cotizacion/propuesta";
import { ajustarAlTotal, proponerPlanPareja, proponerPlanProveedor, totalACobrar } from "@/lib/saldos/plan";

/** Escritura de planes de pago. Siempre dentro de una transacción con la cotización ya bloqueada. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type Filtro = { quoteId: string } | { itemId: string };

const ERRORES_AJUSTE = {
  menor_que_cobrado: "El total quedaría por debajo de lo ya cobrado. Registra primero una devolución a la pareja.",
  editar_plan: "La última cuota quedaría negativa. Edita el plan de pagos.",
} as const;

const ERRORES_AJUSTE_PROVEEDOR = {
  menor_que_cobrado: "El monto a pagar no puede quedar por debajo de lo ya pagado al proveedor.",
  editar_plan: "La última cuota del proveedor quedaría negativa. Edita su plan de pagos.",
} as const;

/** Se rechaza cambiar al proveedor (o quién lo paga) mientras tenga pagos vigentes. */
export const MENSAJE_PAGOS_PROVEEDOR = "Este proveedor tiene pagos registrados. Anúlalos o registra su devolución en Saldos antes de cambiarlo.";

/** Lee la cotización bloqueándola (FOR UPDATE): nadie la cambia a la vez. Toda escritura de dinero empieza aquí. */
export async function bloquear(tx: Tx, quoteId: string) {
  const [c] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).for("update");
  return c ?? null;
}

async function cotizacion(tx: Tx, quoteId: string) {
  const [c] = await tx.select({ eventDate: quotes.eventDate, acceptedVersionId: quotes.acceptedVersionId }).from(quotes).where(eq(quotes.id, quoteId));
  return c ?? null;
}

/** Lo que cobra Nova Event: su paquete congelado, las líneas con paga = payer y los ajustes no anulados. */
export async function totalCotizacion(tx: Tx, quoteId: string): Promise<number> {
  const c = await cotizacion(tx, quoteId);
  if (!c?.acceptedVersionId) return 0;
  const [[v], lineas, ajustes] = await Promise.all([
    tx.select({ frozen: quoteVersions.frozen }).from(quoteVersions).where(eq(quoteVersions.id, c.acceptedVersionId)),
    tx.select({ supplierId: quoteItems.supplierId, payer: quoteItems.payer, frozen: quoteItems.frozen }).from(quoteItems).where(eq(quoteItems.versionId, c.acceptedVersionId)),
    tx.select({ amountCents: quoteAdjustments.amountCents }).from(quoteAdjustments).where(and(eq(quoteAdjustments.quoteId, quoteId), isNull(quoteAdjustments.voidedAt))),
  ]);
  return totalACobrar(
    leerVersionCongelada(v?.frozen)?.precio ?? null,
    lineas.map((l) => ({ total: leerLineaCongelada(l.frozen)?.total ?? 0, paga: l.supplierId ? l.payer : ("nova" as const) })),
    ajustes.map((a) => a.amountCents),
  );
}

async function netoMovimientos(tx: Tx, donde: ReturnType<typeof and>, suma: "cobro" | "pago_proveedor", resta: "devolucion" | "devolucion_proveedor") {
  const [r] = await tx
    .select({
      neto: sql<number>`coalesce(sum(case when ${paymentMovements.kind} = ${suma} then ${paymentMovements.amountCents} when ${paymentMovements.kind} = ${resta} then -${paymentMovements.amountCents} else 0 end), 0)::int`,
    })
    .from(paymentMovements)
    .where(and(donde, isNull(paymentMovements.voidedAt)));
  return r?.neto ?? 0;
}

/** Cobros menos devoluciones a la pareja, sin anulados. */
export function cobradoNeto(tx: Tx, quoteId: string): Promise<number> {
  return netoMovimientos(tx, eq(paymentMovements.quoteId, quoteId), "cobro", "devolucion");
}

/** Pagos menos devoluciones del proveedor de una línea, sin anulados. */
export function pagadoNetoLinea(tx: Tx, itemId: string): Promise<number> {
  return netoMovimientos(tx, eq(paymentMovements.itemId, itemId), "pago_proveedor", "devolucion_proveedor");
}

/** Plan de la pareja por defecto; reemplaza el que hubiera. */
export async function crearPlanPareja(tx: Tx, quoteId: string, hoy: string): Promise<void> {
  const c = await cotizacion(tx, quoteId);
  if (!c) return;
  await tx.delete(paymentInstallments).where(and(eq(paymentInstallments.quoteId, quoteId), isNull(paymentInstallments.itemId)));
  const plan = proponerPlanPareja(await totalCotizacion(tx, quoteId), hoy, c.eventDate);
  if (!plan.length) return;
  await tx.insert(paymentInstallments).values(plan.map((p, i) => ({ quoteId, itemId: null, name: p.nombre, amountCents: p.monto, dueDate: p.vence, sortOrder: i })));
}

/** Plan de pago al proveedor de una línea que paga Nova. No hace nada si la línea ya tiene cuotas. */
export async function crearPlanProveedor(tx: Tx, itemId: string, hoy: string): Promise<void> {
  const [l] = await tx
    .select({ quoteId: quoteVersions.quoteId, supplierId: quoteItems.supplierId, payer: quoteItems.payer, payableCents: quoteItems.payableCents, frozen: quoteItems.frozen })
    .from(quoteItems)
    .innerJoin(quoteVersions, eq(quoteItems.versionId, quoteVersions.id))
    .where(eq(quoteItems.id, itemId));
  if (!l || !l.supplierId || l.payer !== "nova") return;
  const [existe] = await tx.select({ id: paymentInstallments.id }).from(paymentInstallments).where(eq(paymentInstallments.itemId, itemId)).limit(1);
  if (existe) return;
  const [[c], [p]] = await Promise.all([
    tx.select({ eventDate: quotes.eventDate }).from(quotes).where(eq(quotes.id, l.quoteId)),
    tx.select({ advancePct: suppliers.advancePct, balanceDays: suppliers.balanceDays }).from(suppliers).where(eq(suppliers.id, l.supplierId)),
  ]);
  if (!c) return;
  const monto = l.payableCents ?? leerLineaCongelada(l.frozen)?.total ?? 0;
  const plan = proponerPlanProveedor(monto, p?.advancePct ?? null, p?.balanceDays ?? null, hoy, c.eventDate);
  if (!plan.length) return;
  await tx.insert(paymentInstallments).values(plan.map((x, i) => ({ quoteId: l.quoteId, itemId, name: x.nombre, amountCents: x.monto, dueDate: x.vence, sortOrder: i })));
}

/** Lleva un plan (de la pareja o de una línea) a `total`: la última cuota con algo por cubrir absorbe la diferencia. */
async function ajustarPlan(tx: Tx, quoteId: string, itemId: string | null, pagado: number, total: number, hoy: string): Promise<string | null> {
  const actuales = await tx
    .select()
    .from(paymentInstallments)
    .where(and(eq(paymentInstallments.quoteId, quoteId), itemId ? eq(paymentInstallments.itemId, itemId) : isNull(paymentInstallments.itemId)))
    .orderBy(asc(paymentInstallments.sortOrder), asc(paymentInstallments.dueDate));
  const r = ajustarAlTotal(
    actuales.map((a) => ({ id: a.id, nombre: a.name, monto: a.amountCents, vence: a.dueDate })),
    pagado,
    total,
    hoy,
  );
  if (!r.ok) return itemId ? ERRORES_AJUSTE_PROVEEDOR[r.error] : ERRORES_AJUSTE[r.error];
  const conservadas = new Set(r.cuotas.flatMap((c) => (c.id ? [c.id] : [])));
  const sobran = actuales.filter((a) => !conservadas.has(a.id)).map((a) => a.id);
  if (sobran.length) await tx.delete(paymentInstallments).where(inArray(paymentInstallments.id, sobran));
  for (const [i, c] of r.cuotas.entries()) {
    if (c.id) await tx.update(paymentInstallments).set({ name: c.nombre, amountCents: c.monto, dueDate: c.vence, sortOrder: i }).where(eq(paymentInstallments.id, c.id));
    else await tx.insert(paymentInstallments).values({ quoteId, itemId, name: c.nombre, amountCents: c.monto, dueDate: c.vence, sortOrder: i });
  }
  return null;
}

/** Ajusta el plan de la pareja al total actual. null = ok; si no, el texto de error para mostrar. */
export async function reajustarPlanPareja(tx: Tx, quoteId: string, hoy: string): Promise<string | null> {
  return ajustarPlan(tx, quoteId, null, await cobradoNeto(tx, quoteId), await totalCotizacion(tx, quoteId), hoy);
}

/**
 * Ajusta el plan de una línea a su monto a pagar (payableCents o el total congelado).
 * Sin cuotas todavía (proveedor sin confirmar) no hace nada: el plan se arma al confirmar.
 */
export async function reajustarPlanProveedor(tx: Tx, itemId: string, hoy: string): Promise<string | null> {
  const [l] = await tx
    .select({ quoteId: quoteVersions.quoteId, payableCents: quoteItems.payableCents, frozen: quoteItems.frozen })
    .from(quoteItems)
    .innerJoin(quoteVersions, eq(quoteItems.versionId, quoteVersions.id))
    .where(eq(quoteItems.id, itemId));
  if (!l) return null;
  const [existe] = await tx.select({ id: paymentInstallments.id }).from(paymentInstallments).where(eq(paymentInstallments.itemId, itemId)).limit(1);
  if (!existe) return null;
  const monto = l.payableCents ?? leerLineaCongelada(l.frozen)?.total ?? 0;
  return ajustarPlan(tx, l.quoteId, itemId, await pagadoNetoLinea(tx, itemId), monto, hoy);
}

/** ¿Hay movimientos? Por defecto solo los no anulados; `incluirAnulados` cuenta también los anulados (su recibo no se puede perder). */
export async function tieneMovimientos(tx: Tx, f: Filtro, opciones: { incluirAnulados?: boolean } = {}): Promise<boolean> {
  const donde = "itemId" in f ? eq(paymentMovements.itemId, f.itemId) : eq(paymentMovements.quoteId, f.quoteId);
  const [m] = await tx
    .select({ id: paymentMovements.id })
    .from(paymentMovements)
    .where(opciones.incluirAnulados ? donde : and(donde, isNull(paymentMovements.voidedAt)))
    .limit(1);
  return !!m;
}

/** Borra las cuotas de una línea o de toda la cotización (pareja y proveedores). */
export async function borrarPlanes(tx: Tx, f: Filtro): Promise<void> {
  await tx.delete(paymentInstallments).where("itemId" in f ? eq(paymentInstallments.itemId, f.itemId) : eq(paymentInstallments.quoteId, f.quoteId));
}

/** Un texto devuelto dentro de la transacción la revierte y llega tal cual a la persona. */
export class Revertir extends Error {}

export async function transaccion<T extends object>(fn: (tx: Tx) => Promise<T | string>): Promise<T | string> {
  try {
    return await db.transaction(async (tx) => {
      const r = await fn(tx);
      if (typeof r === "string") throw new Revertir(r);
      return r;
    });
  } catch (e) {
    if (e instanceof Revertir) return e.message;
    throw e;
  }
}

/** Línea de la versión aceptada (con proveedor) de una cotización ya bloqueada. */
export async function lineaAceptada(tx: Tx, itemId: string, c: { id: string; acceptedVersionId: string | null }) {
  const [l] = await tx
    .select({
      id: quoteItems.id,
      versionId: quoteItems.versionId,
      supplierId: quoteItems.supplierId,
      payer: quoteItems.payer,
      payableCents: quoteItems.payableCents,
      confirmation: quoteItems.confirmation,
      frozen: quoteItems.frozen,
    })
    .from(quoteItems)
    .innerJoin(quoteVersions, eq(quoteItems.versionId, quoteVersions.id))
    .where(and(eq(quoteItems.id, itemId), eq(quoteVersions.quoteId, c.id)));
  if (!l || l.versionId !== c.acceptedVersionId || l.confirmation === null) return null;
  const f = leerLineaCongelada(l.frozen);
  return { ...l, proveedor: f?.proveedor ?? f?.etiqueta ?? null, aPagar: l.payableCents ?? f?.total ?? 0 };
}
