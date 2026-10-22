import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  archivosPermitidos,
  codigoCotizacion,
  congelarLinea,
  esTokenValido,
  leerLineaCongelada,
  leerVersionCongelada,
  listaIncluye,
  versionesVisibles,
} from "./propuesta";

describe("codigoCotizacion", () => {
  it("rellena a 4 dígitos", () => expect(codigoCotizacion(2026, 7)).toBe("COT-2026-0007"));
  it("más de 4 dígitos no se corta", () => expect(codigoCotizacion(2026, 12345)).toBe("COT-2026-12345"));
});

describe("archivosPermitidos", () => {
  it("solo claves de proveedores visibles", () => {
    const r = archivosPermitidos(["a"], ["proveedores/a/x.webp", "proveedores/b/y.webp"]);
    expect([...r]).toEqual(["proveedores/a/x.webp"]);
  });
  it("claves sin segundo segmento se excluyen", () => {
    expect(archivosPermitidos(["a"], ["suelto"]).size).toBe(0);
  });
});

describe("congelarLinea", () => {
  it("copia plana solo con los 4 campos", () => {
    const origen = { proveedor: "p1", paquete: null, etiqueta: "DJ", total: 500, extra: "x" };
    const c = congelarLinea(origen);
    expect(c).toEqual({ proveedor: "p1", paquete: null, etiqueta: "DJ", total: 500 });
    expect(c).not.toBe(origen);
  });
});

describe("leerLineaCongelada", () => {
  it("lee la copia con sus 4 campos", () => {
    expect(leerLineaCongelada({ proveedor: "Flores", paquete: "Básico", etiqueta: "Flores", total: 100, otro: 1 })).toEqual({
      proveedor: "Flores",
      paquete: "Básico",
      etiqueta: "Flores",
      total: 100,
    });
  });
  it("null si falta o está mal formada", () => {
    expect(leerLineaCongelada(null)).toBeNull();
    expect(leerLineaCongelada({ etiqueta: "x", total: 1.5 })).toBeNull();
    expect(leerLineaCongelada({ total: 1 })).toBeNull();
  });
});

describe("listaIncluye", () => {
  it("sin base: solo los renglones, limpios", () => expect(listaIncluye(null, [" A ", "", "B"])).toEqual(["A", "B"]));
  it("con base: primero el paquete del que hereda", () => expect(listaIncluye("Esencia", ["A"])).toEqual(["Todo lo del paquete Esencia", "A"]));
});

describe("leerVersionCongelada", () => {
  it("lee la copia del paquete Nova", () => {
    expect(leerVersionCongelada({ nombre: "Esencia", precio: 400000, frase: null, incluye: ["A"], extra: 1 })).toEqual({
      nombre: "Esencia",
      precio: 400000,
      frase: null,
      incluye: ["A"],
    });
  });
  it("null si falta o está mal formada", () => {
    expect(leerVersionCongelada(null)).toBeNull();
    expect(leerVersionCongelada({ nombre: "X", precio: 1.5, frase: null, incluye: [] })).toBeNull();
    expect(leerVersionCongelada({ nombre: "X", precio: 1, frase: 3, incluye: [] })).toBeNull();
    expect(leerVersionCongelada({ nombre: "X", precio: 1, frase: null, incluye: [1] })).toBeNull();
    expect(leerVersionCongelada({ precio: 1, incluye: [] })).toBeNull();
  });
});

describe("versionesVisibles", () => {
  const vs = [
    { id: "a", showInProposal: true },
    { id: "b", showInProposal: false },
    { id: "c", showInProposal: true },
  ];
  it("no aceptada: las marcadas", () => {
    expect(versionesVisibles({ status: "sent", acceptedVersionId: null }, vs).map((v) => v.id)).toEqual(["a", "c"]);
  });
  it("aceptada: solo la aceptada, aunque no esté marcada", () => {
    expect(versionesVisibles({ status: "accepted", acceptedVersionId: "b" }, vs).map((v) => v.id)).toEqual(["b"]);
  });
  it("aceptada sin versión encontrada: ninguna", () => {
    expect(versionesVisibles({ status: "accepted", acceptedVersionId: null }, vs)).toEqual([]);
    expect(versionesVisibles({ status: "accepted", acceptedVersionId: "x" }, vs)).toEqual([]);
  });
  it("una aceptada anterior no cuenta si ya no está aceptada", () => {
    expect(versionesVisibles({ status: "draft", acceptedVersionId: "b" }, vs).map((v) => v.id)).toEqual(["a", "c"]);
  });
});

describe("esTokenValido", () => {
  it("acepta los tokens que se generan", () => {
    for (let i = 0; i < 20; i++) expect(esTokenValido(randomBytes(24).toString("base64url"))).toBe(true);
  });
  it("rechaza largo distinto, otros caracteres y rutas", () => {
    expect(esTokenValido("")).toBe(false);
    expect(esTokenValido("a".repeat(31))).toBe(false);
    expect(esTokenValido("a".repeat(33))).toBe(false);
    expect(esTokenValido("a".repeat(31) + "=")).toBe(false);
    expect(esTokenValido("a".repeat(31) + "+")).toBe(false);
    expect(esTokenValido("../" + "a".repeat(29))).toBe(false);
    expect(esTokenValido("a".repeat(32) + "\n")).toBe(false);
  });
});
