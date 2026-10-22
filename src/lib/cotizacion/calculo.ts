// Cálculos de cotización. Todo en centavos enteros.

export type Modo = "fixed" | "per_person";
export type LineaCalculo = { modo: Modo; precioUnitario: number; manual: boolean; total: number };

/** per_person × invitados; fixed tal cual. */
export function totalLinea(modo: Modo, precioUnitario: number, invitados: number): number {
  return modo === "per_person" ? precioUnitario * invitados : precioUnitario;
}

export function totalesVersion(
  lineas: { total: number }[],
  nova: number | null,
): { proveedores: number; nova: number; general: number } {
  const proveedores = lineas.reduce((s, l) => s + l.total, 0);
  const n = nova ?? 0;
  return { proveedores, nova: n, general: proveedores + n };
}

/** Verde < 85 %, amarillo 85 %–100 %, rojo > 100 %. Sin presupuesto: "ninguno". */
export function estadoPresupuesto(
  gastado: number,
  presupuesto: number | null,
): { tono: "verde" | "amarillo" | "rojo" | "ninguno"; porcentaje: number; restante: number } {
  if (presupuesto === null || presupuesto <= 0) return { tono: "ninguno", porcentaje: 0, restante: 0 };
  const porcentaje = (gastado / presupuesto) * 100;
  const tono = gastado > presupuesto ? "rojo" : porcentaje >= 85 ? "amarillo" : "verde";
  return { tono, porcentaje, restante: presupuesto - gastado };
}

/** Recalcula solo las líneas per_person que no se editaron a mano. */
export function recalcularPorInvitados<T extends LineaCalculo>(lineas: T[], invitados: number): T[] {
  return lineas.map((l) =>
    l.modo === "per_person" && !l.manual
      ? { ...l, total: totalLinea(l.modo, l.precioUnitario, invitados) }
      : l,
  );
}
