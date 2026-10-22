import "server-only";
import { and, asc, desc, eq, exists, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { paymentInstallments, paymentMovements, quoteAdjustments, quoteItems, quoteVersions, quotes, suppliers, users } from "@/db/schema";
import { leerLineaCongelada, leerVersionCongelada } from "@/lib/cotizacion/propuesta";
import { estadoCuotas, totalACobrar, type CuotaConEstado, type EstadoCuota } from "@/lib/saldos/plan";

type CuotaBase = { id: string; nombre: string; monto: number; vence: string };
type Cuota = CuotaConEstado<CuotaBase>;
export type MovimientoCuenta = {
  id: string;
  kind: (typeof paymentMovements.$inferSelect)["kind"];
  monto: number;
  fecha: string;
  forma: (typeof paymentMovements.$inferSelect)["method"];
  referencia: string | null;
  fileKey: string | null;
  recibo: string | null;
  recibidoPor: string | null;
  nota: string | null;
  anulado: boolean;
  motivo: string | null;
};
export type ProveedorCuenta = {
  itemId: string;
  proveedor: string;
  etiqueta: string;
  paga: "nova" | "client";
  confirmacion: (typeof quoteItems.$inferSelect)["confirmation"];
  totalLinea: number;
  aPagar: number;
  pagado: number;
  /** «50 % adelanto · resto 7 días antes» */
  condicion: string;
  cuotas: Cuota[];
  movimientos: MovimientoCuenta[];
  adelantoUrgente: boolean;
};
export type CuentaEvento = {
  cotizacion: Pick<
    typeof quotes.$inferSelect,
    "id" | "code" | "clientName" | "eventDate" | "startTime" | "endTime" | "status" | "shareEnabled" | "shareToken" | "showPayments" | "cancelledAt" | "cancelReason"
  >;
  total: number;
  /** Neto: cobros menos devoluciones, sin anulados. */
  cobrado: number;
  devuelto: number;
  cuotas: Cuota[];
  ajustes: { id: string; concepto: string; monto: number; anulado: boolean; motivo: string | null; fecha: string }[];
  movimientos: MovimientoCuenta[];
  proveedores: ProveedorCuenta[];
  pagadoProveedores: number;
  faltaProveedores: number;
  /** Lo cobrado menos lo pagado a proveedores. */
  quedaReal: number;
  /** Total menos lo que se paga a proveedores a través de Nova. */
  quedaPrevisto: number;
  /** Nova ya pagó a proveedores más de lo que cobró. */
  ponePlataNova: boolean;
};

const zona = () => process.env.APP_TIMEZONE || "America/La_Paz";
const diaDe = (t: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zona() }).format(t);

/** «50 % adelanto · resto 7 días antes». Sin datos del proveedor se usa el estándar 50 % / -7. */
function condicionDe(p: { advancePct: number | null; balanceDays: number | null; paymentTerms: string | null }): string {
  if (p.advancePct === null && p.balanceDays === null && p.paymentTerms?.trim()) return p.paymentTerms.trim();
  const pct = p.advancePct ?? 50;
  const dias = p.balanceDays ?? -7;
  if (pct >= 100) return "Todo al confirmar";
  const n = Math.abs(dias);
  const resto = dias === 0 ? "resto el día del evento" : `resto ${n} ${n === 1 ? "día" : "días"} ${dias < 0 ? "antes" : "después"}`;
  return pct <= 0 ? `R${resto.slice(1)}` : `${pct} % adelanto · ${resto}`;
}

/** Arma las cuentas de varias cotizaciones con unas pocas consultas (no una por cotización). */
async function cuentas(ids: string[], hoy: string): Promise<Map<string, CuentaEvento>> {
  const out = new Map<string, CuentaEvento>();
  if (!ids.length) return out;
  const cotizaciones = await db
    .select({
      id: quotes.id,
      code: quotes.code,
      clientName: quotes.clientName,
      eventDate: quotes.eventDate,
      startTime: quotes.startTime,
      endTime: quotes.endTime,
      status: quotes.status,
      shareEnabled: quotes.shareEnabled,
      shareToken: quotes.shareToken,
      showPayments: quotes.showPayments,
      cancelledAt: quotes.cancelledAt,
      cancelReason: quotes.cancelReason,
      acceptedVersionId: quotes.acceptedVersionId,
    })
    .from(quotes)
    .where(and(inArray(quotes.id, ids), inArray(quotes.status, ["accepted", "cancelled"])));
  if (!cotizaciones.length) return out;
  const idsOk = cotizaciones.map((c) => c.id);
  const versiones = cotizaciones.flatMap((c) => (c.acceptedVersionId ? [c.acceptedVersionId] : []));

  const [vers, lineas, ajustes, cuotasBD, movs] = await Promise.all([
    versiones.length ? db.select({ id: quoteVersions.id, frozen: quoteVersions.frozen }).from(quoteVersions).where(inArray(quoteVersions.id, versiones)) : [],
    versiones.length
      ? db
          .select({
            id: quoteItems.id,
            versionId: quoteItems.versionId,
            supplierId: quoteItems.supplierId,
            payer: quoteItems.payer,
            payableCents: quoteItems.payableCents,
            confirmation: quoteItems.confirmation,
            frozen: quoteItems.frozen,
            label: quoteItems.label,
            advancePct: suppliers.advancePct,
            balanceDays: suppliers.balanceDays,
            paymentTerms: suppliers.paymentTerms,
          })
          .from(quoteItems)
          .leftJoin(suppliers, eq(quoteItems.supplierId, suppliers.id))
          .where(inArray(quoteItems.versionId, versiones))
          .orderBy(asc(quoteItems.sortOrder))
      : [],
    db.select().from(quoteAdjustments).where(inArray(quoteAdjustments.quoteId, idsOk)).orderBy(asc(quoteAdjustments.createdAt)),
    db.select().from(paymentInstallments).where(inArray(paymentInstallments.quoteId, idsOk)).orderBy(asc(paymentInstallments.sortOrder), asc(paymentInstallments.dueDate)),
    db
      .select({ m: paymentMovements, recibidoPor: users.name })
      .from(paymentMovements)
      .leftJoin(users, eq(paymentMovements.handledById, users.id))
      .where(inArray(paymentMovements.quoteId, idsOk))
      .orderBy(asc(paymentMovements.date), asc(paymentMovements.createdAt)),
  ]);

  const verPorId = new Map(vers.map((v) => [v.id, v.frozen]));
  const movimiento = ({ m, recibidoPor }: (typeof movs)[number]): MovimientoCuenta => ({
    id: m.id,
    kind: m.kind,
    monto: m.amountCents,
    fecha: m.date,
    forma: m.method,
    referencia: m.reference,
    fileKey: m.fileKey,
    recibo: m.receiptCode,
    recibidoPor,
    nota: m.note,
    anulado: m.voidedAt !== null,
    motivo: m.voidReason,
  });
  const cuota = (c: (typeof cuotasBD)[number]): CuotaBase => ({ id: c.id, nombre: c.name, monto: c.amountCents, vence: c.dueDate });
  const neto = (lista: MovimientoCuenta[], suma: MovimientoCuenta["kind"], resta: MovimientoCuenta["kind"]) =>
    lista.reduce((s, m) => (m.anulado ? s : m.kind === suma ? s + m.monto : m.kind === resta ? s - m.monto : s), 0);

  for (const c of cotizaciones) {
    const cancelada = c.status === "cancelled";
    const propias = lineas.filter((l) => l.versionId === c.acceptedVersionId);
    const ajustesQ = ajustes.filter((a) => a.quoteId === c.id);
    const movsQ = movs.filter((x) => x.m.quoteId === c.id);
    const pareja = movsQ.filter((x) => x.m.itemId === null).map(movimiento);

    const total = totalACobrar(
      leerVersionCongelada(c.acceptedVersionId ? verPorId.get(c.acceptedVersionId) : null)?.precio ?? null,
      propias.map((l) => ({ total: leerLineaCongelada(l.frozen)?.total ?? 0, paga: l.supplierId ? l.payer : ("nova" as const) })),
      ajustesQ.filter((a) => !a.voidedAt).map((a) => a.amountCents),
    );
    const cobrado = neto(pareja, "cobro", "devolucion");
    const devuelto = pareja.reduce((s, m) => (!m.anulado && m.kind === "devolucion" ? s + m.monto : s), 0);
    const cuotasPareja = estadoCuotas(
      cuotasBD.filter((q) => q.quoteId === c.id && q.itemId === null).map(cuota),
      cobrado,
      hoy,
    ).cuotas;

    const proveedores: ProveedorCuenta[] = propias
      .filter((l) => l.supplierId)
      .map((l) => {
        const f = leerLineaCongelada(l.frozen);
        const totalLinea = f?.total ?? 0;
        const movsL = movsQ.filter((x) => x.m.itemId === l.id).map(movimiento);
        const pagado = neto(movsL, "pago_proveedor", "devolucion_proveedor");
        const cuotasL = l.payer === "nova" ? cuotasBD.filter((q) => q.itemId === l.id).map(cuota) : [];
        const conEstado = estadoCuotas(cuotasL, pagado, hoy).cuotas;
        return {
          itemId: l.id,
          proveedor: f?.proveedor ?? l.label,
          etiqueta: f?.etiqueta ?? l.label,
          paga: l.payer,
          confirmacion: l.confirmation,
          totalLinea,
          aPagar: l.payer === "nova" ? (l.payableCents ?? totalLinea) : 0,
          pagado,
          condicion: condicionDe(l),
          cuotas: conEstado,
          movimientos: movsL,
          adelantoUrgente: !cancelada && conEstado.some((q) => q.nombre === "Adelanto" && q.falta > 0 && q.vence <= hoy),
        };
      });
    const pagadoProveedores = proveedores.reduce((s, p) => s + p.pagado, 0);
    // En una cancelada las cuotas no son deuda.
    const faltaProveedores = cancelada ? 0 : proveedores.reduce((s, p) => s + p.cuotas.reduce((t, q) => t + q.falta, 0), 0);

    out.set(c.id, {
      cotizacion: {
        id: c.id,
        code: c.code,
        clientName: c.clientName,
        eventDate: c.eventDate,
        startTime: c.startTime,
        endTime: c.endTime,
        status: c.status,
        shareEnabled: c.shareEnabled,
        shareToken: c.shareToken,
        showPayments: c.showPayments,
        cancelledAt: c.cancelledAt,
        cancelReason: c.cancelReason,
      },
      total,
      cobrado,
      devuelto,
      cuotas: cuotasPareja,
      ajustes: ajustesQ.map((a) => ({ id: a.id, concepto: a.concept, monto: a.amountCents, anulado: a.voidedAt !== null, motivo: a.voidReason, fecha: diaDe(a.createdAt) })),
      movimientos: pareja,
      proveedores,
      pagadoProveedores,
      faltaProveedores,
      quedaReal: cobrado - pagadoProveedores,
      quedaPrevisto: total - proveedores.reduce((s, p) => s + p.aPagar, 0),
      ponePlataNova: pagadoProveedores > cobrado,
    });
  }
  return out;
}

/** Cuenta completa de un evento; null si la cotización no está aceptada ni cancelada. */
export async function cuentaEvento(quoteId: string, hoy: string): Promise<CuentaEvento | null> {
  return (await cuentas([quoteId], hoy)).get(quoteId) ?? null;
}

export type FiltroSaldos = { q: string; estado: "" | "vencidos" | "por_vencer" | "al_dia" | "pagado" | "canceladas" };
export type FilaSaldo = {
  id: string;
  code: string;
  clientName: string;
  eventDate: string;
  status: "accepted" | "cancelled";
  total: number;
  cobrado: number;
  /** Porcentaje cobrado, redondeado. */
  pct: number;
  /** Primera cuota de la pareja con algo por cobrar. */
  proximo: { nombre: string; vence: string; falta: number; estado: EstadoCuota } | null;
  /** Alguna cuota vencida o un adelanto urgente. */
  vencido: boolean;
};

export async function listaSaldos(f: FiltroSaldos, hoy: string): Promise<FilaSaldo[]> {
  const filtros: SQL[] = [];
  if (f.estado === "canceladas") filtros.push(eq(quotes.status, "cancelled"));
  else {
    const conMovimientos = exists(db.select({ x: sql`1` }).from(paymentMovements).where(eq(paymentMovements.quoteId, quotes.id)));
    filtros.push(or(eq(quotes.status, "accepted"), and(eq(quotes.status, "cancelled"), conMovimientos))!);
  }
  if (f.q) {
    const patron = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
    filtros.push(or(ilike(quotes.clientName, patron), ilike(quotes.code, patron))!);
  }
  const filas = await db.select({ id: quotes.id }).from(quotes).where(and(...filtros)).orderBy(desc(quotes.createdAt));
  const mapa = await cuentas(filas.map((x) => x.id), hoy);

  const lista: FilaSaldo[] = [];
  for (const { id } of filas) {
    const c = mapa.get(id);
    if (!c) continue;
    const cancelada = c.cotizacion.status === "cancelled";
    const proxima = cancelada ? undefined : c.cuotas.find((q) => q.falta > 0);
    const vencido = !cancelada && (c.cuotas.some((q) => q.estado === "vencida") || c.proveedores.some((p) => p.adelantoUrgente));
    const porVencer = !cancelada && c.cuotas.some((q) => q.estado === "por_vencer");
    const pagado = c.cobrado >= c.total;
    if (f.estado === "vencidos" && !vencido) continue;
    if (f.estado === "por_vencer" && !porVencer) continue;
    if (f.estado === "al_dia" && (cancelada || vencido || pagado)) continue;
    if (f.estado === "pagado" && (cancelada || !pagado)) continue;
    lista.push({
      id,
      code: c.cotizacion.code,
      clientName: c.cotizacion.clientName,
      eventDate: c.cotizacion.eventDate,
      status: cancelada ? "cancelled" : "accepted",
      total: c.total,
      cobrado: c.cobrado,
      pct: c.total > 0 ? Math.round((c.cobrado / c.total) * 100) : 0,
      proximo: proxima ? { nombre: proxima.nombre, vence: proxima.vence, falta: proxima.falta, estado: proxima.estado } : null,
      vencido,
    });
  }
  // Con algo vencido primero; después por próximo vencimiento (sin vencimiento al final).
  return lista.sort((a, b) => Number(b.vencido) - Number(a.vencido) || (a.proximo?.vence ?? "9999").localeCompare(b.proximo?.vence ?? "9999"));
}

export async function resumenGeneral(hoy: string): Promise<{ porCobrarMes: number; vencido: number; porPagarProveedores: number; adelantosUrgentes: number }> {
  const r = { porCobrarMes: 0, vencido: 0, porPagarProveedores: 0, adelantosUrgentes: 0 };
  const mes = hoy.slice(0, 7);
  const aceptadas = await db.select({ id: quotes.id }).from(quotes).where(eq(quotes.status, "accepted"));
  for (const c of (await cuentas(aceptadas.map((a) => a.id), hoy)).values()) {
    for (const q of c.cuotas) {
      if (q.estado === "vencida") r.vencido += q.falta;
      else if (q.falta > 0 && q.vence.slice(0, 7) === mes) r.porCobrarMes += q.falta;
    }
    r.porPagarProveedores += c.faltaProveedores;
    r.adelantosUrgentes += c.proveedores.filter((p) => p.adelantoUrgente).length;
  }
  return r;
}
