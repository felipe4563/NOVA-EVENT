import { describe, expect, it } from "vitest";
import { ajustarAlTotal, correrFechas, estadoCuotas, proponerPlanPareja, proponerPlanProveedor, repartirFaltante, totalACobrar } from "./plan";

const HOY = "2026-10-21";

describe("proponerPlanPareja", () => {
  it("30/40/30 con la mitad del camino", () => {
    expect(proponerPlanPareja(6200000, HOY, "2027-02-20")).toEqual([
      { nombre: "Anticipo", monto: 1860000, vence: "2026-10-21" },
      { nombre: "Cuota 1", monto: 2480000, vence: "2026-12-13" },
      { nombre: "Saldo final", monto: 1860000, vence: "2027-02-05" },
    ]);
  });
  it("la última absorbe la diferencia", () => {
    expect(proponerPlanPareja(1000050, HOY, "2027-02-20").map((c) => c.monto)).toEqual([300000, 400000, 300050]);
  });
  it("evento cercano: tres cuotas", () => {
    const p = proponerPlanPareja(5000000, HOY, "2026-11-10");
    expect(p).toHaveLength(3);
    expect(p[1].vence).toBe("2026-10-23");
    expect(p[2].vence).toBe("2026-10-26");
  });
  it("evento muy cercano: sin Cuota 1", () => {
    expect(proponerPlanPareja(5000000, HOY, "2026-10-31")).toEqual([
      { nombre: "Anticipo", monto: 1500000, vence: "2026-10-21" },
      { nombre: "Saldo final", monto: 3500000, vence: "2026-10-21" },
    ]);
  });
  it("la mitad cae hoy: sin Cuota 1", () => {
    const p = proponerPlanPareja(5000000, HOY, "2026-11-06");
    expect(p).toHaveLength(2);
    expect(p[1].vence).toBe("2026-10-22");
  });
  it("total 0 devuelve []", () => expect(proponerPlanPareja(0, HOY, "2027-02-20")).toEqual([]));
});

describe("proponerPlanProveedor", () => {
  const EV = "2027-02-20";
  it("50 % y -7 días", () => {
    expect(proponerPlanProveedor(1200000, 50, -7, HOY, EV)).toEqual([
      { nombre: "Adelanto", monto: 600000, vence: "2026-10-21" },
      { nombre: "Saldo", monto: 600000, vence: "2027-02-13" },
    ]);
  });
  it("30 % redondea a Bs", () => {
    const p = proponerPlanProveedor(550000, 30, 0, HOY, EV);
    expect(p.map((c) => c.monto)).toEqual([165000, 385000]);
    expect(p[1].vence).toBe("2027-02-20");
  });
  it("0 % solo Saldo", () => {
    expect(proponerPlanProveedor(300000, 0, 0, HOY, EV)).toEqual([{ nombre: "Saldo", monto: 300000, vence: "2027-02-20" }]);
  });
  it("100 % solo Adelanto", () => {
    expect(proponerPlanProveedor(300000, 100, 0, HOY, EV)).toEqual([{ nombre: "Adelanto", monto: 300000, vence: HOY }]);
  });
  it("null usa los valores por defecto", () => {
    expect(proponerPlanProveedor(1200000, null, null, HOY, EV)).toEqual(proponerPlanProveedor(1200000, 50, -7, HOY, EV));
  });
  it("días positivos después del evento", () => {
    expect(proponerPlanProveedor(1200000, 50, 3, HOY, EV)[1].vence).toBe("2027-02-23");
  });
  it("el saldo nunca vence antes de hoy", () => {
    expect(proponerPlanProveedor(1200000, 50, -7, HOY, "2026-10-25")[1].vence).toBe(HOY);
  });
  it("monto 0 devuelve []", () => expect(proponerPlanProveedor(0, 50, -7, HOY, EV)).toEqual([]));
});

describe("estadoCuotas", () => {
  const base = [
    { nombre: "A", monto: 10000, vence: "2026-10-01" },
    { nombre: "B", monto: 20000, vence: "2026-10-25" },
    { nombre: "C", monto: 30000, vence: "2026-12-01" },
  ];
  it("pagado parcial llena desde la primera", () => {
    const r = estadoCuotas(base, 15000, HOY);
    expect(r.cuotas.map((c) => c.estado)).toEqual(["pagada", "por_vencer", "pendiente"]);
    expect(r.cuotas[0].falta).toBe(0);
    expect(r.cuotas[1]).toMatchObject({ cubierto: 5000, falta: 15000 });
    expect(r.sobrante).toBe(0);
  });
  it("sin pagos la primera está vencida", () => {
    expect(estadoCuotas(base, 0, HOY).cuotas[0].estado).toBe("vencida");
  });
  it("sobrante", () => {
    const r = estadoCuotas(base, 70000, HOY);
    expect(r.cuotas.every((c) => c.estado === "pagada")).toBe(true);
    expect(r.sobrante).toBe(10000);
  });
  it("límite de 7 días", () => {
    const con = (vence: string) => estadoCuotas([{ nombre: "B", monto: 20000, vence }], 0, HOY).cuotas[0].estado;
    expect(con("2026-10-28")).toBe("por_vencer");
    expect(con("2026-10-29")).toBe("pendiente");
    expect(con("2026-10-21")).toBe("por_vencer");
  });
  it("parcial si está lejos de vencer y tiene algo cubierto", () => {
    expect(estadoCuotas([{ nombre: "B", monto: 20000, vence: "2026-10-29" }], 5000, HOY).cuotas[0].estado).toBe("parcial");
  });
});

describe("ajustarAlTotal", () => {
  const cuotas = [
    { nombre: "A", monto: 1860000, vence: "2026-10-21" },
    { nombre: "B", monto: 2480000, vence: "2026-12-13" },
    { nombre: "C", monto: 1860000, vence: "2027-02-05" },
  ];
  it("la última con falta absorbe", () => {
    const r = ajustarAlTotal(cuotas, 4340000, 6000000, HOY);
    expect(r.ok && r.cuotas.map((c) => c.monto)).toEqual([1860000, 2480000, 1660000]);
  });
  it("si queda en 0 se quita", () => {
    const r = ajustarAlTotal(cuotas, 4340000, 4340000, HOY);
    expect(r.ok && r.cuotas.map((c) => c.nombre)).toEqual(["A", "B"]);
  });
  it("menor que lo cobrado", () => {
    expect(ajustarAlTotal(cuotas, 4340000, 4000000, HOY)).toEqual({ ok: false, error: "menor_que_cobrado" });
  });
  it("sin cuotas con falta agrega Saldo adicional", () => {
    const r = ajustarAlTotal(cuotas, 6200000, 6500000, HOY);
    expect(r.ok && r.cuotas.at(-1)).toEqual({ nombre: "Saldo adicional", monto: 300000, vence: "2026-10-28" });
  });
  it("editar_plan si la última no alcanza", () => {
    const c = [
      { nombre: "A", monto: 10000, vence: HOY },
      { nombre: "B", monto: 5000, vence: HOY },
      { nombre: "C", monto: 5000, vence: HOY },
    ];
    expect(ajustarAlTotal(c, 10000, 12000, HOY)).toEqual({ ok: false, error: "editar_plan" });
  });
});

describe("repartirFaltante", () => {
  const cuotas = [
    { nombre: "A", monto: 300000, vence: "2026-10-21" },
    { nombre: "B", monto: 400000, vence: "2026-12-13" },
    { nombre: "C", monto: 300000, vence: "2027-02-05" },
  ];
  it("las pagadas no cambian", () => {
    expect(repartirFaltante(cuotas, 300000, 1000000).map((c) => c.monto)).toEqual([300000, 350000, 350000]);
  });
  it("la última absorbe la diferencia", () => {
    expect(repartirFaltante(cuotas, 0, 1000000).map((c) => c.monto)).toEqual([333300, 333300, 333400]);
  });
});

describe("correrFechas", () => {
  const cuotas = [
    { nombre: "A", monto: 10000, vence: "2026-10-01" },
    { nombre: "B", monto: 20000, vence: "2026-12-13" },
  ];
  it("solo mueve las que tienen falta", () => {
    expect(correrFechas(cuotas, 10000, 14, HOY).map((c) => c.vence)).toEqual(["2026-10-01", "2026-12-27"]);
  });
  it("ninguna queda antes de hoy", () => {
    expect(correrFechas(cuotas, 10000, -60, HOY)[1].vence).toBe(HOY);
  });
});

describe("totalACobrar", () => {
  const lineas = [
    { total: 1000000, paga: "nova" as const },
    { total: 410000, paga: "client" as const },
  ];
  it("paquete + líneas que paga Nova + ajustes", () => {
    expect(totalACobrar(400000, lineas, [-50000])).toBe(1350000);
  });
  it("sin paquete", () => {
    expect(totalACobrar(null, lineas, [-50000])).toBe(950000);
  });
});
