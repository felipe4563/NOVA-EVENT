/** Recibos y formas de pago. */

export const FORMAS_PAGO = ["efectivo", "transferencia", "qr"] as const;
export type FormaPago = (typeof FORMAS_PAGO)[number];

export const ETIQUETA_FORMA: Record<FormaPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  qr: "QR",
};

/** Correlativo por año: (2026, 1) → "REC-2026-0001". */
export function codigoRecibo(anio: number, n: number): string {
  return `REC-${anio}-${String(n).padStart(4, "0")}`;
}

export type MovimientoParaRecibo = {
  kind: "cobro" | "devolucion";
  monto: number;
  /** AAAA-MM-DD */
  fecha: string;
  /** Número del recibo (solo los cobros lo tienen). */
  seq: number | null;
  anulado: boolean;
};

/**
 * Lo pagado a la fecha de un recibo (incluyéndolo) y lo que queda: neto de cobros menos devoluciones, sin anulados.
 * Cuentan los cobros anteriores por fecha y, el mismo día, los de número menor o igual; las devoluciones de ese día o antes.
 */
export function saldoAlRecibo(
  total: number,
  movimientos: MovimientoParaRecibo[],
  recibo: { fecha: string; seq: number },
): { pagado: number; saldo: number } {
  let pagado = 0;
  for (const m of movimientos) {
    if (m.anulado) continue;
    if (m.kind === "cobro") {
      if (m.fecha < recibo.fecha || (m.fecha === recibo.fecha && (m.seq ?? 0) <= recibo.seq)) pagado += m.monto;
    } else if (m.fecha <= recibo.fecha) pagado -= m.monto;
  }
  return { pagado, saldo: total - pagado };
}
