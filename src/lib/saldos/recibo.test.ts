import { describe, expect, it } from "vitest";
import { codigoRecibo, ETIQUETA_FORMA, FORMAS_PAGO, saldoAlRecibo, type MovimientoParaRecibo } from "./recibo";

describe("recibo", () => {
  it("codigoRecibo", () => expect(codigoRecibo(2026, 1)).toBe("REC-2026-0001"));
  it("codigoRecibo con más dígitos", () => expect(codigoRecibo(2026, 12345)).toBe("REC-2026-12345"));
  it("formas de pago con etiqueta", () => {
    expect(FORMAS_PAGO.map((f) => ETIQUETA_FORMA[f])).toEqual(["Efectivo", "Transferencia", "QR"]);
  });
});

describe("saldoAlRecibo", () => {
  const cobro = (monto: number, fecha: string, seq: number, anulado = false): MovimientoParaRecibo => ({ kind: "cobro", monto, fecha, seq, anulado });
  const devol = (monto: number, fecha: string): MovimientoParaRecibo => ({ kind: "devolucion", monto, fecha, seq: null, anulado: false });

  it("solo cuenta hasta este recibo por fecha", () => {
    const m = [cobro(100, "2026-01-01", 1), cobro(200, "2026-02-01", 2), cobro(300, "2026-03-01", 3)];
    expect(saldoAlRecibo(1000, m, { fecha: "2026-02-01", seq: 2 })).toEqual({ pagado: 300, saldo: 700 });
  });
  it("el mismo día cuenta por número: incluye el suyo y los menores, no los mayores", () => {
    const m = [cobro(100, "2026-02-01", 5), cobro(200, "2026-02-01", 6), cobro(300, "2026-02-01", 7)];
    expect(saldoAlRecibo(1000, m, { fecha: "2026-02-01", seq: 6 })).toEqual({ pagado: 300, saldo: 700 });
  });
  it("un recibo de número menor pero fecha posterior no cuenta", () => {
    const m = [cobro(100, "2026-03-01", 1), cobro(200, "2026-02-01", 2)];
    expect(saldoAlRecibo(1000, m, { fecha: "2026-02-01", seq: 2 })).toEqual({ pagado: 200, saldo: 800 });
  });
  it("excluye cobros anulados", () => {
    const m = [cobro(100, "2026-01-01", 1, true), cobro(200, "2026-02-01", 2)];
    expect(saldoAlRecibo(1000, m, { fecha: "2026-02-01", seq: 2 })).toEqual({ pagado: 200, saldo: 800 });
  });
  it("resta las devoluciones de ese día o antes, no las posteriores", () => {
    const m = [cobro(500, "2026-01-01", 1), devol(50, "2026-01-15"), devol(70, "2026-02-01"), devol(90, "2026-02-02"), cobro(200, "2026-02-01", 2)];
    expect(saldoAlRecibo(1000, m, { fecha: "2026-02-01", seq: 2 })).toEqual({ pagado: 580, saldo: 420 });
  });
});
