import { describe, expect, it } from "vitest";
import { fechaMovimientoMinima, permitidoEnCancelada } from "./movimiento";

describe("permitidoEnCancelada", () => {
  it("solo las devoluciones", () => {
    expect(permitidoEnCancelada("devolucion")).toBe(true);
    expect(permitidoEnCancelada("devolucion_proveedor")).toBe(true);
    expect(permitidoEnCancelada("cobro")).toBe(false);
    expect(permitidoEnCancelada("pago_proveedor")).toBe(false);
  });
});

describe("fechaMovimientoMinima", () => {
  it("366 días antes de hoy", () => {
    expect(fechaMovimientoMinima("2026-10-22")).toBe("2025-10-21");
    expect(fechaMovimientoMinima("2025-03-01")).toBe("2024-02-29");
  });
});
