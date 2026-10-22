import { describe, expect, it } from "vitest";
import { enlaceRed, enlaceTelefono, enlaceWeb, enlaceWhatsApp, usuarioRed } from "./empresa-enlaces";

describe("enlaceRed", () => {
  it("acepta usuario con o sin @", () => {
    expect(enlaceRed("instagram", "@nova.event")).toBe("https://instagram.com/nova.event");
    expect(enlaceRed("instagram", "nova.event")).toBe("https://instagram.com/nova.event");
    expect(enlaceRed("tiktok", "@nova.event")).toBe("https://tiktok.com/@nova.event");
  });
  it("acepta la dirección con o sin https y www", () => {
    expect(enlaceRed("facebook", "facebook.com/NovaEvent")).toBe("https://facebook.com/NovaEvent");
    expect(enlaceRed("instagram", "https://www.instagram.com/nova.event/")).toBe("https://instagram.com/nova.event");
  });
  it("rechaza otra red, protocolos raros o texto inválido", () => {
    expect(enlaceRed("instagram", "https://evil.com/nova")).toBeNull();
    expect(enlaceRed("instagram", "javascript:alert(1)")).toBeNull();
    expect(enlaceRed("instagram", "hola mundo")).toBeNull();
    expect(enlaceRed("instagram", "")).toBeNull();
    expect(enlaceRed("instagram", "instagram.com/")).toBeNull();
  });
});

describe("usuarioRed", () => {
  it("muestra @usuario", () => {
    expect(usuarioRed("https://instagram.com/nova.event")).toBe("@nova.event");
    expect(usuarioRed("https://tiktok.com/@nova.event")).toBe("@nova.event");
  });
});

describe("enlaceWhatsApp", () => {
  it("deja solo dígitos y agrega el mensaje", () => {
    expect(enlaceWhatsApp("+591 712 34567")).toBe("https://wa.me/59171234567");
    expect(enlaceWhatsApp("+591 71234567", "Hola Nova")).toBe("https://wa.me/59171234567?text=Hola%20Nova");
  });
  it("rechaza números muy cortos o vacíos", () => {
    expect(enlaceWhatsApp("123")).toBeNull();
    expect(enlaceWhatsApp(null)).toBeNull();
  });
});

describe("enlaceWeb y enlaceTelefono", () => {
  it("completa https y rechaza lo inválido", () => {
    expect(enlaceWeb("novaevent.bo")).toBe("https://novaevent.bo/");
    expect(enlaceWeb("javascript:alert(1)")).toBeNull();
    expect(enlaceWeb("hola")).toBeNull();
  });
  it("tel: con + y dígitos", () => {
    expect(enlaceTelefono("+591 2 2771234")).toBe("tel:+59122771234");
    expect(enlaceTelefono("12")).toBeNull();
  });
});
