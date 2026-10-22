import { describe, expect, it } from "vitest";
import { aCentavos, deCentavos, formatoBs } from "./dinero";

describe("formatoBs", () => {
  it("formatea sin decimales si son cero", () => {
    expect(formatoBs(800000)).toBe("Bs 8.000");
    expect(formatoBs(0)).toBe("Bs 0");
  });
  it("formatea con decimales si no son cero", () => {
    expect(formatoBs(800050)).toBe("Bs 8.000,50");
    expect(formatoBs(5)).toBe("Bs 0,05");
    expect(formatoBs(123456789)).toBe("Bs 1.234.567,89");
  });
});

describe("aCentavos", () => {
  it("respeta el tope de 32 bits", () => {
    expect(aCentavos("20.000.000")).toBe(2000000000);
    expect(aCentavos("20.000.000,01")).toBeNull();
  });

  it("interpreta enteros y miles", () => {
    expect(aCentavos("8000")).toBe(800000);
    expect(aCentavos("8.000")).toBe(800000);
  });
  it("interpreta decimales con coma", () => {
    expect(aCentavos("8000,5")).toBe(800050);
    expect(aCentavos("8.000,50")).toBe(800050);
  });
  it("devuelve null si es inválido o negativo", () => {
    expect(aCentavos("-1")).toBeNull();
    expect(aCentavos("abc")).toBeNull();
    expect(aCentavos("")).toBeNull();
    expect(aCentavos("1,234")).toBeNull();
  });
});

describe("deCentavos", () => {
  it("devuelve texto para inputs", () => {
    expect(deCentavos(800050)).toBe("8000,50");
    expect(deCentavos(800000)).toBe("8000");
  });
});
