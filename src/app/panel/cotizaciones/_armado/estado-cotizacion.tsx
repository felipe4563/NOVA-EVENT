import { Insignia } from "@/components/ui";
import type { EstadoQuote } from "@/lib/cotizacion/aceptacion";

export type { EstadoQuote };

/** "Vencida" no se guarda: es una cotización enviada cuya validez ya pasó. */
export function estaVencida(status: EstadoQuote, validUntil: string | null, hoy: string) {
  return status === "sent" && validUntil !== null && validUntil < hoy;
}

export const ETIQUETAS_ESTADO: Record<EstadoQuote | "vencida", string> = {
  draft: "Borrador",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
  vencida: "Vencida",
};

const TONOS = { draft: "neutro", sent: "agua", accepted: "vino", rejected: "error", cancelled: "neutro", vencida: "oro" } as const;

export function InsigniaEstado({ status, validUntil, hoy }: { status: EstadoQuote; validUntil: string | null; hoy: string }) {
  const clave = estaVencida(status, validUntil, hoy) ? "vencida" : status;
  return <Insignia tono={TONOS[clave]}>{ETIQUETAS_ESTADO[clave]}</Insignia>;
}
