// Dinero en centavos enteros (nunca float). Formato boliviano: miles "." y decimales ",".

function conMiles(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 800050 -> "Bs 8.000,50"; 800000 -> "Bs 8.000". */
export function formatoBs(centavos: number): string {
  const signo = centavos < 0 ? "-" : "";
  const abs = Math.abs(Math.round(centavos));
  const enteros = Math.floor(abs / 100);
  const cent = abs % 100;
  const dec = cent === 0 ? "" : "," + String(cent).padStart(2, "0");
  return `Bs ${signo}${conMiles(enteros)}${dec}`;
}

/** Tope por monto: cabe en una columna integer (32 bits) de Postgres. Bs 20.000.000. */
export const MAX_CENTAVOS = 2_000_000_000;

/** "8.000,50" -> 800050. null si es inválido, negativo, con más de 2 decimales o mayor que MAX_CENTAVOS. */
export function aCentavos(texto: string): number | null {
  const t = texto.trim();
  const m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const enteros = Number(m[1].replace(/\./g, ""));
  const cent = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
  const total = enteros * 100 + cent;
  return Number.isSafeInteger(total) && total <= MAX_CENTAVOS ? total : null;
}

/** 800050 -> "8000,50"; 800000 -> "8000" (para inputs). */
export function deCentavos(c: number): string {
  const abs = Math.abs(Math.round(c));
  const cent = abs % 100;
  const base = `${c < 0 ? "-" : ""}${Math.floor(abs / 100)}`;
  return cent === 0 ? base : `${base},${String(cent).padStart(2, "0")}`;
}
