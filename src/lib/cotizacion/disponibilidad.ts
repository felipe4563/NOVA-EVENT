// Disponibilidad de un proveedor frente a un evento. Horas "HH:MM" o "HH:MM:SS".

export type Bloque = { startTime: string | null; endTime: string | null };

function minutos(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

export function estadoDisponibilidad(
  bloques: Bloque[],
  evento: { inicio: string | null; fin: string | null },
): "libre" | "parcial" | "ocupado" {
  if (bloques.length === 0) return "libre";
  // Bloque sin horario = todo el día.
  if (bloques.some((b) => b.startTime === null && b.endTime === null)) return "ocupado";
  // Evento sin horario: no se puede saber si se superpone.
  if (evento.inicio === null && evento.fin === null) return "parcial";
  const ei = evento.inicio === null ? 0 : minutos(evento.inicio);
  const ef = evento.fin === null ? 24 * 60 : minutos(evento.fin);
  const choca = bloques.some((b) => {
    const bi = b.startTime === null ? 0 : minutos(b.startTime);
    const bf = b.endTime === null ? 24 * 60 : minutos(b.endTime);
    return bi < ef && ei < bf;
  });
  return choca ? "ocupado" : "parcial";
}

/** Rangos ocupados "HH:MM–HH:MM", ordenados y sin repetir. Vacío si no hay bloques o si alguno es todo el día. */
export function rangosOcupados(bloques: Bloque[]): string[] {
  if (bloques.some((b) => b.startTime === null && b.endTime === null)) return [];
  const hhmm = (t: string | null, def: string) => (t ?? def).slice(0, 5);
  const rangos = bloques.map((b) => `${hhmm(b.startTime, "00:00")}–${hhmm(b.endTime, "24:00")}`).sort();
  return [...new Set(rangos)];
}

/** Texto de la insignia: "Libre", "Ocupado ese día" u "Ocupado 10:00–14:00" (hasta dos rangos, luego "+N"). */
export function textoDisponibilidad(estado: "libre" | "parcial" | "ocupado", rangos: string[]): string {
  if (estado === "libre") return "Libre";
  if (!rangos.length) return estado === "ocupado" ? "Ocupado ese día" : "Ocupado algunas horas";
  const resto = rangos.length - 2;
  return `Ocupado ${rangos.slice(0, 2).join(", ")}${resto > 0 ? ` +${resto}` : ""}`;
}
