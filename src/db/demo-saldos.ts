/**
 * Saldos de EJEMPLO (solo los usa demo.ts, con SEED_DEMO=true): planes de pago, cobros, pagos a proveedores,
 * un ajuste y un evento cancelado con devolución parcial. Corre suelto en el migrador de Docker (sin alias «@/»
 * ni Next), por eso solo importa archivos relativos sin dependencias y trae sus propias fechas.
 * Es idempotente: si la cotización de ejemplo ya tiene cobros, pagos o ajustes, no se toca.
 */
import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { detalleEvento } from "../lib/cotizacion/aceptacion";
import { codigoRecibo } from "../lib/saldos/recibo";
import { MARCA } from "./demo-cotizaciones";
import { db } from "./index";
import { paymentInstallments, paymentMovements, quoteAdjustments, quoteItems, quoteVersions, quotes, supplierBusy, suppliers } from "./schema";

/* Fechas como texto AAAA-MM-DD (este script corre suelto, sin Next). */
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TIMEZONE || "America/La_Paz" }).format(new Date());
function sumarDias(fecha: string, n: number) {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}
const minFecha = (a: string, b: string) => (a < b ? a : b);
/** A bolivianos enteros (múltiplos de 100 centavos). */
const aBs = (centavos: number) => Math.round(centavos / 100) * 100;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Cuota = { nombre: string; monto: number; vence: string };

async function cotizacionDemo(cliente: string) {
  const [q] = await db.select().from(quotes).where(and(eq(quotes.clientName, cliente), like(quotes.notes, `${MARCA}%`)));
  return q ?? null;
}

async function lineas(tx: Tx, versionId: string) {
  const filas = await tx
    .select({ id: quoteItems.id, supplierId: quoteItems.supplierId, proveedor: suppliers.name, payer: quoteItems.payer, confirmation: quoteItems.confirmation, frozen: quoteItems.frozen })
    .from(quoteItems)
    .leftJoin(suppliers, eq(quoteItems.supplierId, suppliers.id))
    .where(eq(quoteItems.versionId, versionId))
    .orderBy(quoteItems.sortOrder);
  return filas.map((l) => ({ ...l, total: l.frozen?.total ?? 0 }));
}

/** Plan 30/40/30 redondeado a bolivianos; la última cuota absorbe la diferencia. */
function planPareja(total: number, fechas: [string, string, string]): Cuota[] {
  const a = aBs(total * 0.3);
  const b = aBs(total * 0.4);
  return [
    { nombre: "Anticipo", monto: a, vence: fechas[0] },
    { nombre: "Cuota 1", monto: b, vence: fechas[1] },
    { nombre: "Saldo final", monto: total - a - b, vence: fechas[2] },
  ];
}

/** Adelanto por porcentaje (redondeado a Bs) y el resto como saldo. */
function planProveedor(monto: number, pct: number, vencen: [string, string]): Cuota[] {
  const adelanto = aBs((monto * pct) / 100);
  return [
    { nombre: "Adelanto", monto: adelanto, vence: vencen[0] },
    { nombre: "Saldo", monto: monto - adelanto, vence: vencen[1] },
  ].filter((c) => c.monto > 0);
}

async function guardarPlan(tx: Tx, quoteId: string, itemId: string | null, plan: Cuota[]) {
  await tx.insert(paymentInstallments).values(plan.map((c, i) => ({ quoteId, itemId, name: c.nombre, amountCents: c.monto, dueDate: c.vence, sortOrder: i })));
}

/** Cobro con recibo del año de su fecha: siguiente número libre, igual que la app. */
async function cobrar(tx: Tx, quoteId: string, monto: number, fecha: string, method: "efectivo" | "transferencia" | "qr", reference: string | null) {
  const anio = Number(fecha.slice(0, 4));
  const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${paymentMovements.receiptSeq}), 0)` }).from(paymentMovements).where(eq(paymentMovements.receiptYear, anio));
  const seq = Number(max) + 1;
  await tx.insert(paymentMovements).values({
    quoteId,
    kind: "cobro",
    amountCents: monto,
    date: fecha,
    method,
    reference,
    receiptYear: anio,
    receiptSeq: seq,
    receiptCode: codigoRecibo(anio, seq),
  });
}

/** Enlace público activo, para ver «Mis pagos» como la pareja. */
async function enlace(tx: Tx, quoteId: string) {
  await tx.update(quotes).set({ shareToken: randomBytes(24).toString("base64url"), shareEnabled: true }).where(and(eq(quotes.id, quoteId), isNull(quotes.shareToken)));
}

async function boda(): Promise<boolean> {
  const q = await cotizacionDemo("Boda García & Mendoza");
  if (!q || q.status !== "accepted" || !q.acceptedVersionId) return false;
  const [mov] = await db.select({ id: paymentMovements.id }).from(paymentMovements).where(eq(paymentMovements.quoteId, q.id)).limit(1);
  const [aju] = await db.select({ id: quoteAdjustments.id }).from(quoteAdjustments).where(eq(quoteAdjustments.quoteId, q.id)).limit(1);
  if (mov || aju) return false;

  const hoyF = hoy();
  const versionId = q.acceptedVersionId;
  await db.transaction(async (tx) => {
    await enlace(tx, q.id);
    // Confirmar a más proveedores (como el equipo en «Cotizaciones»): reservan su día en el calendario.
    const confirmar = ["Sabores de la Abuela Catering", "Flores del Sol"];
    for (const l of await lineas(tx, versionId)) {
      if (!l.supplierId || !l.proveedor || !confirmar.includes(l.proveedor) || l.confirmation === "confirmed") continue;
      const [b] = await tx
        .insert(supplierBusy)
        .values({ supplierId: l.supplierId, date: q.eventDate, startTime: q.startTime, endTime: q.endTime, detail: detalleEvento(q.clientName, q.code), byStaff: true })
        .returning({ id: supplierBusy.id });
      await tx.update(quoteItems).set({ confirmation: "confirmed", busyId: b.id }).where(eq(quoteItems.id, l.id));
    }
    // El DJ lo paga la pareja directo.
    const djs = tx.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, "DJ Marco Beats"));
    await tx.update(quoteItems).set({ payer: "client" }).where(and(eq(quoteItems.versionId, versionId), inArray(quoteItems.supplierId, djs)));

    await tx.insert(quoteAdjustments).values({ quoteId: q.id, concept: "Descuento por referido", amountCents: -50000 });

    const [v] = await tx.select({ frozen: quoteVersions.frozen }).from(quoteVersions).where(eq(quoteVersions.id, versionId));
    const ls = await lineas(tx, versionId);
    const total = (v?.frozen?.precio ?? 0) + ls.filter((l) => !l.supplierId || l.payer === "nova").reduce((s, l) => s + l.total, 0) - 50000;

    // Pareja: anticipo (QR) y Cuota 1 (transferencia) cobrados; el saldo final vence pronto.
    const plan = planPareja(total, [sumarDias(hoyF, -30), sumarDias(hoyF, -3), minFecha(sumarDias(q.eventDate, -15), sumarDias(hoyF, 5))]);
    await guardarPlan(tx, q.id, null, plan);
    await cobrar(tx, q.id, plan[0].monto, sumarDias(hoyF, -28), "qr", null);
    await cobrar(tx, q.id, plan[1].monto, sumarDias(hoyF, -4), "transferencia", "TRF-48213");

    // Proveedores que paga Nova (confirmados): uno al día, uno con el adelanto vencido y uno pendiente.
    const saldo = sumarDias(q.eventDate, -7);
    const confirmadas = (await lineas(tx, versionId)).filter((l) => l.supplierId && l.payer === "nova" && l.confirmation === "confirmed");
    const dePago: Record<string, { pct: number; adelanto: string }> = {
      "Hacienda Los Sauces": { pct: 50, adelanto: sumarDias(hoyF, -20) },
      "Sabores de la Abuela Catering": { pct: 50, adelanto: sumarDias(hoyF, -6) },
      "Flores del Sol": { pct: 50, adelanto: sumarDias(hoyF, 4) },
    };
    for (const l of confirmadas) {
      const d = l.proveedor ? dePago[l.proveedor] : undefined;
      if (!d) continue;
      const cuotas = planProveedor(l.total, d.pct, [d.adelanto, saldo]);
      await guardarPlan(tx, q.id, l.id, cuotas);
      if (l.proveedor === "Hacienda Los Sauces") {
        await tx.insert(paymentMovements).values({ quoteId: q.id, itemId: l.id, kind: "pago_proveedor", amountCents: cuotas[0].monto, date: d.adelanto, method: "transferencia", reference: "TRF-30977" });
      }
    }
  });
  return true;
}

async function cancelado(): Promise<boolean> {
  const q = await cotizacionDemo("Cumpleaños de Andrés");
  if (!q || q.status !== "cancelled" || !q.acceptedVersionId) return false;
  const [mov] = await db.select({ id: paymentMovements.id }).from(paymentMovements).where(eq(paymentMovements.quoteId, q.id)).limit(1);
  if (mov) return false;

  const hoyF = hoy();
  const versionId = q.acceptedVersionId;
  await db.transaction(async (tx) => {
    await enlace(tx, q.id);
    const [v] = await tx.select({ frozen: quoteVersions.frozen }).from(quoteVersions).where(eq(quoteVersions.id, versionId));
    const total = (v?.frozen?.precio ?? 0) + (await lineas(tx, versionId)).reduce((s, l) => s + l.total, 0);
    const plan = planPareja(total, [sumarDias(hoyF, -20), sumarDias(hoyF, 10), sumarDias(hoyF, 25)]);
    await guardarPlan(tx, q.id, null, plan);
    await cobrar(tx, q.id, plan[0].monto, sumarDias(hoyF, -18), "efectivo", null);
    // Devolución parcial: la mitad de lo cobrado (la política de la empresa retiene el resto).
    await tx.insert(paymentMovements).values({
      quoteId: q.id,
      kind: "devolucion",
      amountCents: aBs(plan[0].monto / 2),
      date: sumarDias(hoyF, -5),
      method: "transferencia",
      reference: "DEV-11520",
    });
  });
  return true;
}

export async function cargarSaldosDemo() {
  const a = await boda();
  const b = await cancelado();
  const nuevos = [a && "Boda García & Mendoza", b && "Cumpleaños de Andrés (cancelado)"].filter(Boolean);
  console.log(nuevos.length ? `✓ Saldos de ejemplo cargados: ${nuevos.join(", ")}` : "· Saldos de ejemplo ya cargados");
}

/** Borra cobros, pagos y ajustes de las cotizaciones de ejemplo (FK restrict); las cuotas caen con la cotización. Antes que ellas. */
export async function borrarSaldosDemo() {
  const ids = (await db.select({ id: quotes.id }).from(quotes).where(like(quotes.notes, `${MARCA}%`))).map((q) => q.id);
  if (!ids.length) return 0;
  const m = await db.delete(paymentMovements).where(inArray(paymentMovements.quoteId, ids)).returning({ id: paymentMovements.id });
  const a = await db.delete(quoteAdjustments).where(inArray(quoteAdjustments.quoteId, ids)).returning({ id: quoteAdjustments.id });
  return m.length + a.length;
}
