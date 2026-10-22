import { describe, expect, it } from "vitest";
import { montoEnLetras } from "./letras";

describe("montoEnLetras", () => {
  const casos: [number, string][] = [
    [1860000, "dieciocho mil seiscientos 00/100 bolivianos"],
    [100, "uno 00/100 bolivianos"],
    [2100, "veintiuno 00/100 bolivianos"],
    [2100000, "veintiún mil 00/100 bolivianos"],
    [10000000, "cien mil 00/100 bolivianos"],
    [12345650, "ciento veintitrés mil cuatrocientos cincuenta y seis 50/100 bolivianos"],
    [0, "cero 00/100 bolivianos"],
    [100000000, "un millón 00/100 bolivianos"],
    [2000000000, "veinte millones 00/100 bolivianos"],
    [150000, "mil quinientos 00/100 bolivianos"],
    [50000000, "quinientos mil 00/100 bolivianos"],
    [2100100, "veintiún mil uno 00/100 bolivianos"],
  ];
  for (const [c, texto] of casos) it(`${c} → ${texto}`, () => expect(montoEnLetras(c)).toBe(texto));
});
