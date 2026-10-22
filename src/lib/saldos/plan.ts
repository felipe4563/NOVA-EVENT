/**
 * Planes de pago y estado de las cuotas. Todo en centavos enteros y fechas "AAAA-MM-DD".
 * Lógica pura: "hoy" siempre llega como texto, nunca se lee del reloj.
 */
import { diasEntre, sumarDias } from "@/lib/fechas";
import { aBs, cubrirCuotas } from "./reparto";

export { repartirFaltante } from "./reparto";

export type CuotaNueva = { nombre: string; monto: number; vence: string };
/** `id` presente si la cuota ya existe en la BD. */
export type Cuota = CuotaNueva & { id?: string };
export type EstadoCuota = "pagada" | "vencida" | "por_vencer" | "parcial" | "pendiente";
export type CuotaConEstado<T extends Cuota> = T & { cubierto: number; falta: number; estado: EstadoCuota };

/** Días de aviso para marcar una cuota como «por vencer» (incluye hoy). */
const DIAS_POR_VENCER = 7;

const maxFecha = (a: string, b: string) => (a > b ? a : b);

/** Anticipo 30 % al aceptar, Cuota 1 40 % a mitad de camino y Saldo final 30 % quince días antes del evento. */
export function proponerPlanPareja(total: number, hoy: string, evento: string): CuotaNueva[] {
  if (total <= 0) return [];
  const saldoVence = maxFecha(sumarDias(evento, -15), hoy);
  const mitad = sumarDias(hoy, Math.floor(diasEntre(hoy, saldoVence) / 2));
  const anticipo = aBs(total * 0.3);
  const conCuota1 = mitad !== hoy && mitad !== saldoVence;
  const cuota1 = conCuota1 ? aBs(total * 0.4) : 0;
  const plan: CuotaNueva[] = [{ nombre: "Anticipo", monto: anticipo, vence: hoy }];
  if (conCuota1) plan.push({ nombre: "Cuota 1", monto: cuota1, vence: mitad });
  plan.push({ nombre: "Saldo final", monto: total - anticipo - cuota1, vence: saldoVence });
  return plan;
}

/** Adelanto al confirmar y el resto `diasResto` días respecto al evento (negativo = antes). Sin datos: 50 % y -7. */
export function proponerPlanProveedor(
  monto: number,
  pctAdelanto: number | null,
  diasResto: number | null,
  hoy: string,
  evento: string,
): CuotaNueva[] {
  if (monto <= 0) return [];
  const pct = pctAdelanto ?? 50;
  const saldoVence = maxFecha(sumarDias(evento, diasResto ?? -7), hoy);
  const adelanto = Math.min(monto, Math.max(0, aBs((monto * pct) / 100)));
  const plan: CuotaNueva[] = [];
  if (adelanto > 0) plan.push({ nombre: "Adelanto", monto: adelanto, vence: hoy });
  if (monto - adelanto > 0) plan.push({ nombre: "Saldo", monto: monto - adelanto, vence: saldoVence });
  return plan;
}

/** Los cobros llenan las cuotas en el orden recibido, desde la primera. */
export function estadoCuotas<T extends Cuota>(cuotas: T[], pagado: number, hoy: string): { cuotas: CuotaConEstado<T>[]; sobrante: number } {
  const limite = sumarDias(hoy, DIAS_POR_VENCER);
  const { cuotas: cubiertas, sobrante } = cubrirCuotas(cuotas, pagado);
  const lista = cubiertas.map((c) => {
    let estado: EstadoCuota;
    if (c.falta === 0) estado = "pagada";
    else if (c.vence < hoy) estado = "vencida";
    else if (c.vence <= limite) estado = "por_vencer";
    else if (c.cubierto > 0) estado = "parcial";
    else estado = "pendiente";
    return { ...c, estado };
  });
  return { cuotas: lista, sobrante };
}

/** Si cambia el total de la cotización, la última cuota con falta absorbe la diferencia. */
export function ajustarAlTotal<T extends Cuota>(
  cuotas: T[],
  pagado: number,
  nuevoTotal: number,
  hoy: string,
): { ok: true; cuotas: Cuota[] } | { ok: false; error: "menor_que_cobrado" | "editar_plan" } {
  if (nuevoTotal < pagado) return { ok: false, error: "menor_que_cobrado" };
  const diferencia = nuevoTotal - cuotas.reduce((s, c) => s + c.monto, 0);
  const conEstado = estadoCuotas(cuotas, pagado, hoy).cuotas;
  const ultima = conEstado.findLastIndex((c) => c.falta > 0);
  if (ultima === -1) {
    if (diferencia <= 0) return { ok: true, cuotas: [...cuotas] };
    return { ok: true, cuotas: [...cuotas, { nombre: "Saldo adicional", monto: diferencia, vence: sumarDias(hoy, DIAS_POR_VENCER) }] };
  }
  const monto = cuotas[ultima].monto + diferencia;
  if (monto < 0) return { ok: false, error: "editar_plan" };
  const resultado: Cuota[] = cuotas.map((c, i) => (i === ultima ? { ...c, monto } : c));
  return { ok: true, cuotas: resultado.filter((_, i) => i !== ultima || monto > 0) };
}

/** Mueve `dias` días las cuotas con algo por cubrir; ninguna queda antes de hoy. */
export function correrFechas<T extends Cuota>(cuotas: T[], pagado: number, dias: number, hoy: string): T[] {
  const conEstado = estadoCuotas(cuotas, pagado, hoy).cuotas;
  return cuotas.map((c, i) => (conEstado[i].falta > 0 ? { ...c, vence: maxFecha(sumarDias(c.vence, dias), hoy) } : c));
}

/** Lo que cobra Nova Event: su paquete, las líneas que paga a través de Nova y los ajustes (pueden ser negativos). */
export function totalACobrar(nova: number | null, lineas: { total: number; paga: "nova" | "client" }[], ajustes: number[]): number {
  const delasLineas = lineas.reduce((s, l) => s + (l.paga === "nova" ? l.total : 0), 0);
  return (nova ?? 0) + delasLineas + ajustes.reduce((s, a) => s + a, 0);
}
