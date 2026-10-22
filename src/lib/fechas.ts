/**
 * Fechas de calendario como texto "AAAA-MM-DD" (sin horas ni zona horaria),
 * para que un día ocupado sea el mismo día en cualquier lugar.
 */
import { io } from "next/cache";

export const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
export const RE_MES = /^\d{4}-\d{2}$/;
export const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Hoy en la zona horaria del negocio. */
export async function hoy() {
  await io();
  return new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TIMEZONE || "America/La_Paz" }).format(new Date());
}

function partes(fecha: string) {
  const [a, m, d] = fecha.split("-").map(Number);
  return { a, m, d };
}

function aTexto(dt: Date) {
  return dt.toISOString().slice(0, 10);
}

/** ¿Es una fecha real? (descarta 2026-02-31). */
export function esFechaValida(fecha: string) {
  if (!RE_FECHA.test(fecha)) return false;
  const { a, m, d } = partes(fecha);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function sumarDias(fecha: string, dias: number) {
  const { a, m, d } = partes(fecha);
  return aTexto(new Date(Date.UTC(a, m - 1, d + dias)));
}

export function diasEntre(desde: string, hasta: string) {
  const { a, m, d } = partes(desde);
  const f = partes(hasta);
  return Math.round((Date.UTC(f.a, f.m - 1, f.d) - Date.UTC(a, m - 1, d)) / 86_400_000);
}

export function sumarMeses(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  return aTexto(new Date(Date.UTC(a, m - 1 + n, 1))).slice(0, 7);
}

/** "2026-11" → "noviembre 2026" */
export function nombreMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} ${a}`;
}

/** "2026-11-15" → "domingo 15 de noviembre de 2026" (o sin año). */
export function fechaLarga(fecha: string, conAnio = true) {
  const { a, m, d } = partes(fecha);
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  return `${dia} ${d} de ${MESES[m - 1]}${conAnio ? ` de ${a}` : ""}`;
}

/** "2026-11-15" → "15 nov" */
export function fechaCorta(fecha: string) {
  const { m, d } = partes(fecha);
  return `${d} ${MESES[m - 1].slice(0, 3)}`;
}

/**
 * Semanas del mes para dibujar el calendario (lunes a domingo).
 * Incluye los días del mes anterior y siguiente que completan las semanas.
 */
export function semanasDelMes(mes: string) {
  const primero = `${mes}-01`;
  const { a, m } = partes(primero);
  const diaSemana = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7; // 0 = lunes
  const inicio = sumarDias(primero, -diaSemana);
  const ultimo = aTexto(new Date(Date.UTC(a, m, 0)));
  const semanas: { fecha: string; delMes: boolean }[][] = [];
  for (let dia = inicio; dia <= ultimo || semanas.at(-1)!.length < 7; dia = sumarDias(dia, 1)) {
    if (!semanas.length || semanas.at(-1)!.length === 7) semanas.push([]);
    semanas.at(-1)!.push({ fecha: dia, delMes: dia.startsWith(mes) });
  }
  return semanas;
}

export function agruparPorDia<T extends { date: string }>(lista: T[]) {
  const m = new Map<string, T[]>();
  for (const x of lista) m.set(x.date, [...(m.get(x.date) ?? []), x]);
  return m;
}

/** "14:30:00" → "14:30" */
export function hora(t: string | null) {
  return t ? t.slice(0, 5) : "";
}

export function horario(inicio: string | null, fin: string | null) {
  return inicio && fin ? `${hora(inicio)} – ${hora(fin)}` : "Todo el día";
}
