/** Monto en letras para el recibo, en minúsculas: 1860000 → "dieciocho mil seiscientos 00/100 bolivianos". */

const UNIDADES = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

/** 1 a 999. */
function hasta999(n: number): string {
  if (n === 100) return "cien";
  const partes: string[] = [];
  if (n >= 100) partes.push(CENTENAS[Math.floor(n / 100)]);
  const r = n % 100;
  if (r > 0) {
    if (r < 30) partes.push(UNIDADES[r]);
    else partes.push(r % 10 ? `${DECENAS[Math.floor(r / 10)]} y ${UNIDADES[r % 10]}` : DECENAS[Math.floor(r / 10)]);
  }
  return partes.join(" ");
}

/** "uno" y "veintiuno" pierden la o delante de «mil» y «millón». */
const apocopar = (t: string) => t.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");

function enteroEnLetras(n: number): string {
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? "un millón" : `${apocopar(hasta999(millones))} millones`);
  if (miles) partes.push(miles === 1 ? "mil" : `${apocopar(hasta999(miles))} mil`);
  if (resto) partes.push(hasta999(resto));
  return partes.join(" ");
}

/** Centavos enteros (0 a MAX_CENTAVOS) → "… NN/100 bolivianos". */
export function montoEnLetras(centavos: number): string {
  const bs = Math.floor(centavos / 100);
  const cent = String(centavos % 100).padStart(2, "0");
  return `${enteroEnLetras(bs)} ${cent}/100 bolivianos`;
}
