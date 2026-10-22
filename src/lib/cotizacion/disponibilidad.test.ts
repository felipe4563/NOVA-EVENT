import { describe, expect, it } from "vitest";
import { estadoDisponibilidad, rangosOcupados, textoDisponibilidad } from "./disponibilidad";

const evento = { inicio: "18:00", fin: "23:00" };

describe("estadoDisponibilidad", () => {
  it("sin bloques es libre", () => expect(estadoDisponibilidad([], evento)).toBe("libre"));
  it("bloque todo el día es ocupado", () => {
    expect(estadoDisponibilidad([{ startTime: null, endTime: null }], evento)).toBe("ocupado");
  });
  it("bloque sin superposición es parcial", () => {
    expect(estadoDisponibilidad([{ startTime: "10:00", endTime: "14:00" }], evento)).toBe("parcial");
  });
  it("bloque superpuesto es ocupado", () => {
    expect(estadoDisponibilidad([{ startTime: "10:00", endTime: "14:00" }], { inicio: "13:00", fin: "20:00" })).toBe("ocupado");
  });
  it("evento sin horario y bloque con horas es parcial", () => {
    expect(estadoDisponibilidad([{ startTime: "10:00", endTime: "14:00" }], { inicio: null, fin: null })).toBe("parcial");
  });
  it("acepta HH:MM:SS de Postgres", () => {
    expect(estadoDisponibilidad([{ startTime: "10:00:00", endTime: "14:00:00" }], { inicio: "13:00", fin: "20:00:00" })).toBe("ocupado");
    expect(estadoDisponibilidad([{ startTime: "10:00:00", endTime: "14:00:00" }], { inicio: "14:00:00", fin: "20:00" })).toBe("parcial");
  });
  it("un bloque todo el día entre varios es ocupado", () => {
    expect(estadoDisponibilidad([{ startTime: "10:00", endTime: "11:00" }, { startTime: null, endTime: null }], evento)).toBe("ocupado");
  });
});

describe("rangosOcupados", () => {
  it("sin bloques no hay rangos", () => expect(rangosOcupados([])).toEqual([]));
  it("formatea HH:MM–HH:MM, ordena y quita repetidos", () => {
    expect(
      rangosOcupados([
        { startTime: "16:00:00", endTime: "18:30:00" },
        { startTime: "10:00", endTime: "14:00" },
        { startTime: "10:00:00", endTime: "14:00:00" },
      ]),
    ).toEqual(["10:00–14:00", "16:00–18:30"]);
  });
  it("con un bloque de todo el día no hay rangos", () => {
    expect(rangosOcupados([{ startTime: "10:00", endTime: "11:00" }, { startTime: null, endTime: null }])).toEqual([]);
  });
});

describe("textoDisponibilidad", () => {
  it("libre", () => expect(textoDisponibilidad("libre", [])).toBe("Libre"));
  it("todo el día", () => expect(textoDisponibilidad("ocupado", [])).toBe("Ocupado ese día"));
  it("parcial con horario", () => expect(textoDisponibilidad("parcial", ["10:00–14:00"])).toBe("Ocupado 10:00–14:00"));
  it("superpuesto con horario", () => expect(textoDisponibilidad("ocupado", ["13:00–20:00"])).toBe("Ocupado 13:00–20:00"));
  it("más de dos rangos", () => {
    expect(textoDisponibilidad("parcial", ["08:00–09:00", "10:00–11:00", "12:00–13:00"])).toBe("Ocupado 08:00–09:00, 10:00–11:00 +1");
  });
  it("parcial sin rangos (no debería pasar) cae al texto genérico", () => expect(textoDisponibilidad("parcial", [])).toBe("Ocupado algunas horas"));
});
