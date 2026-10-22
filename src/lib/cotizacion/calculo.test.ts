import { describe, expect, it } from "vitest";
import { estadoPresupuesto, recalcularPorInvitados, totalesVersion, totalLinea, type LineaCalculo } from "./calculo";

describe("totalLinea", () => {
  it("per_person multiplica por invitados", () => expect(totalLinea("per_person", 8500, 120)).toBe(1020000));
  it("fixed queda tal cual", () => expect(totalLinea("fixed", 250000, 120)).toBe(250000));
});

describe("totalesVersion", () => {
  it("suma proveedores y nova", () => {
    expect(totalesVersion([{ total: 100 }, { total: 250 }], 50)).toEqual({ proveedores: 350, nova: 50, general: 400 });
  });
  it("nova null cuenta 0", () => {
    expect(totalesVersion([{ total: 100 }], null)).toEqual({ proveedores: 100, nova: 0, general: 100 });
  });
  it("sin líneas", () => {
    expect(totalesVersion([], null)).toEqual({ proveedores: 0, nova: 0, general: 0 });
  });
});

describe("estadoPresupuesto", () => {
  it("verde bajo 85 %", () => expect(estadoPresupuesto(4249999, 5000000).tono).toBe("verde"));
  it("amarillo desde 85 %", () => expect(estadoPresupuesto(4250000, 5000000).tono).toBe("amarillo"));
  it("amarillo en 100 %", () => expect(estadoPresupuesto(5000000, 5000000).tono).toBe("amarillo"));
  it("rojo sobre 100 %", () => {
    const e = estadoPresupuesto(5000001, 5000000);
    expect(e.tono).toBe("rojo");
    expect(e.restante).toBe(-1);
    expect(e.porcentaje).toBeGreaterThan(100);
  });
  it("sin presupuesto", () => {
    expect(estadoPresupuesto(100, null)).toEqual({ tono: "ninguno", porcentaje: 0, restante: 0 });
  });
  it("presupuesto 0 no divide por cero", () => {
    expect(estadoPresupuesto(100, 0).tono).toBe("ninguno");
  });
});

describe("recalcularPorInvitados", () => {
  const lineas: LineaCalculo[] = [
    { modo: "per_person", precioUnitario: 1000, manual: false, total: 120000 },
    { modo: "per_person", precioUnitario: 1000, manual: true, total: 99 },
    { modo: "fixed", precioUnitario: 5000, manual: false, total: 5000 },
  ];
  it("solo cambia per_person no manual", () => {
    const r = recalcularPorInvitados(lineas, 150);
    expect(r[0].total).toBe(150000);
    expect(r[1]).toEqual(lineas[1]);
    expect(r[2]).toEqual(lineas[2]);
  });
  it("no muta la entrada", () => {
    recalcularPorInvitados(lineas, 150);
    expect(lineas[0].total).toBe(120000);
  });
});
