import { Insignia } from "@/components/ui";
import { diasEntre } from "@/lib/fechas";
import type { EstadoCuota } from "@/lib/saldos/plan";

const TONOS = { pagada: "agua", vencida: "error", por_vencer: "oro", parcial: "neutro", pendiente: "neutro" } as const;
const ETIQUETAS = { pagada: "Pagada", vencida: "Vencida", parcial: "Parcial", pendiente: "Pendiente" } as const;

/** Estado de una cuota; «por vencer» dice cuántos días faltan. */
export function InsigniaCuota({ estado, vence, hoy }: { estado: EstadoCuota; vence: string; hoy: string }) {
  if (estado === "por_vencer") {
    const dias = diasEntre(hoy, vence);
    return <Insignia tono="oro">{dias <= 0 ? "Vence hoy" : `Vence en ${dias} ${dias === 1 ? "día" : "días"}`}</Insignia>;
  }
  return <Insignia tono={TONOS[estado]}>{ETIQUETAS[estado]}</Insignia>;
}
