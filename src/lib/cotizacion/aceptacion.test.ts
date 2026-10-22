import { describe, expect, it } from "vitest";
import { detalleEvento, estadosPermitidos, resumenConfirmaciones, sePuedeAceptar } from "./aceptacion";

describe("estadosPermitidos", () => {
  it("desde borrador: enviada o rechazada", () => expect(estadosPermitidos("draft")).toEqual(["sent", "rejected"]));
  it("desde enviada: rechazada o borrador", () => expect(estadosPermitidos("sent")).toEqual(["rejected", "draft"]));
  it("desde rechazada: enviada o borrador", () => expect(estadosPermitidos("rejected")).toEqual(["sent", "draft"]));
  it("una aceptada no cambia a mano", () => expect(estadosPermitidos("accepted")).toEqual([]));
  it("una cancelada no cambia", () => expect(estadosPermitidos("cancelled")).toEqual([]));
});

describe("sePuedeAceptar", () => {
  it("borrador y enviada sí", () => {
    expect(sePuedeAceptar("draft")).toBe(true);
    expect(sePuedeAceptar("sent")).toBe(true);
  });
  it("una cancelada no", () => expect(sePuedeAceptar("cancelled")).toBe(false));
  it("rechazada y aceptada no", () => {
    expect(sePuedeAceptar("rejected")).toBe(false);
    expect(sePuedeAceptar("accepted")).toBe(false);
  });
});

describe("detalleEvento", () => {
  it("texto exacto", () => expect(detalleEvento("Ana y Luis", "COT-2026-0007")).toBe("Evento de Ana y Luis (COT-2026-0007)"));
});

describe("resumenConfirmaciones", () => {
  it("ignora líneas sin estado (sin proveedor)", () => {
    const r = resumenConfirmaciones([
      { confirmation: "confirmed" },
      { confirmation: "pending" },
      { confirmation: "unavailable" },
      { confirmation: null },
      { confirmation: "confirmed" },
    ]);
    expect(r).toEqual({ total: 4, confirmados: 2, noDisponibles: 1 });
  });
  it("vacío", () => expect(resumenConfirmaciones([])).toEqual({ total: 0, confirmados: 0, noDisponibles: 0 }));
});
