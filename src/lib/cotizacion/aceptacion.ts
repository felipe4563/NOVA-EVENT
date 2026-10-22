// Ayudantes puros para estados, aceptación y confirmación de proveedores.

export type EstadoQuote = "draft" | "sent" | "accepted" | "rejected" | "cancelled";
export type EstadoManual = "draft" | "sent" | "rejected";
export type Confirmacion = "pending" | "confirmed" | "unavailable";

/** Estados a los que se puede pasar a mano desde el actual (una aceptada solo se reabre; una cancelada queda como registro). */
export function estadosPermitidos(actual: EstadoQuote): EstadoManual[] {
  if (actual === "accepted" || actual === "cancelled") return [];
  return (["sent", "rejected", "draft"] as const).filter((e) => e !== actual);
}

/** Solo un borrador o una enviada se pueden aceptar. */
export function sePuedeAceptar(actual: EstadoQuote): boolean {
  return actual === "draft" || actual === "sent";
}

/** Detalle del día ocupado que se crea al confirmar a un proveedor. */
export function detalleEvento(cliente: string, codigo: string): string {
  return `Evento de ${cliente} (${codigo})`;
}

/** "3 de 7 confirmados": solo cuentan las líneas que quedaron por confirmar al aceptar (las que tenían proveedor). */
export function resumenConfirmaciones(lineas: { confirmation: Confirmacion | null }[]) {
  const conEstado = lineas.filter((l) => l.confirmation !== null);
  return {
    total: conEstado.length,
    confirmados: conEstado.filter((l) => l.confirmation === "confirmed").length,
    noDisponibles: conEstado.filter((l) => l.confirmation === "unavailable").length,
  };
}
