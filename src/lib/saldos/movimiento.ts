/** Reglas puras de los movimientos de dinero (cobros, devoluciones y pagos a proveedores). */
import { sumarDias } from "@/lib/fechas";

export type TipoMovimiento = "cobro" | "devolucion" | "pago_proveedor" | "devolucion_proveedor";

/**
 * En un evento cancelado solo se mueven devoluciones (a la pareja o del proveedor):
 * se registran y, si hubo un error, se anulan. Cobros y pagos quedan como estaban.
 */
export function permitidoEnCancelada(tipo: TipoMovimiento): boolean {
  return tipo === "devolucion" || tipo === "devolucion_proveedor";
}

/** Hasta cuántos días atrás se acepta la fecha de un movimiento (evita recibos de años que no corresponden). */
export const DIAS_ATRAS_MOVIMIENTO = 366;

/** Fecha más antigua que se acepta para un movimiento. */
export function fechaMovimientoMinima(hoy: string): string {
  return sumarDias(hoy, -DIAS_ATRAS_MOVIMIENTO);
}
