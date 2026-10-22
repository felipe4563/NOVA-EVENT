/**
 * Parte de los planes de pago que no depende de fechas: se puede importar desde el navegador
 * (plan.ts trae @/lib/fechas, que depende de next/cache). plan.ts lo reexporta.
 */
import type { Cuota } from "./plan";

/** Redondea centavos a bolivianos enteros (múltiplos de 100). */
export const aBs = (centavos: number) => Math.round(centavos / 100) * 100;

/** Los cobros llenan las cuotas en el orden recibido, desde la primera. */
export function cubrirCuotas<T extends Cuota>(cuotas: T[], pagado: number): { cuotas: (T & { cubierto: number; falta: number })[]; sobrante: number } {
  let restante = pagado;
  const lista = cuotas.map((c) => {
    const cubierto = Math.min(c.monto, Math.max(0, restante));
    restante -= cubierto;
    return { ...c, cubierto, falta: c.monto - cubierto };
  });
  return { cuotas: lista, sobrante: Math.max(0, restante) };
}

/** Reparte lo que falta en partes iguales (en Bs) entre las cuotas no pagadas; la última absorbe la diferencia. */
export function repartirFaltante<T extends Cuota>(cuotas: T[], pagado: number, total: number): T[] {
  const conEstado = cubrirCuotas(cuotas, pagado).cuotas;
  const abiertas = conEstado.flatMap((c, i) => (c.falta > 0 ? [i] : []));
  if (!abiertas.length) return [...cuotas];
  const resto = total - conEstado.reduce((s, c) => s + (c.falta === 0 ? c.monto : 0), 0);
  const parte = aBs(resto / abiertas.length);
  const ultima = abiertas.at(-1);
  return cuotas.map((c, i) => {
    if (!abiertas.includes(i)) return c;
    return { ...c, monto: i === ultima ? resto - parte * (abiertas.length - 1) : parte };
  });
}
