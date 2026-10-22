import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

const U1 = "0b9d1c1e-3f5a-4c1e-9a53-0d6a7b1c2d3e";
const U2 = "7c2e8a44-1b6d-4f0a-8e2b-5a9c3d4e6f70";

// UPLOADS_DIR se lee al importar el módulo: se fija antes de cargarlo.
const carpeta = await mkdtemp(path.join(os.tmpdir(), "nova-archivos-"));
process.env.UPLOADS_DIR = carpeta;
const { ErrorArchivo, esClaveGaleria, guardarComprobante, rutaSegura } = await import("./archivos");

afterAll(() => rm(carpeta, { recursive: true, force: true }));

describe("esClaveGaleria", () => {
  it("un comprobante no es de la galería", () => expect(esClaveGaleria(`pagos/${U1}/${U2}.pdf`)).toBe(false));
  it("una imagen de proveedor sí", () => expect(esClaveGaleria(`proveedores/${U1}/${U2}.webp`)).toBe(true));
  it("una clave inválida no", () => expect(esClaveGaleria("proveedores/../x.webp")).toBe(false));
});

describe("rutaSegura", () => {
  it("acepta pagos/<uuid>/<uuid>.pdf y .webp", () => {
    expect(rutaSegura(`pagos/${U1}/${U2}.pdf`)).not.toBeNull();
    expect(rutaSegura(`pagos/${U1}/${U2}.webp`)).not.toBeNull();
  });
  it("rechaza salirse de la carpeta o extensiones ajenas", () => {
    expect(rutaSegura("pagos/../x.pdf")).toBeNull();
    expect(rutaSegura(`pagos/${U1}/${U2}.mp3`)).toBeNull();
  });
});

describe("guardarComprobante", () => {
  it("un PDF se guarda tal cual", async () => {
    const pdf = Buffer.from("%PDF-1.4\ncontenido");
    const r = await guardarComprobante(U1, U2, pdf);
    expect(r).toEqual({ fileKey: `pagos/${U1}/${U2}.pdf`, mime: "application/pdf" });
    expect(await readFile(rutaSegura(r.fileKey)!)).toEqual(pdf);
  });
  it("una imagen grande pasa a WebP de máx. 2000 px", async () => {
    const png = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: "#c33" } }).png().toBuffer();
    const r = await guardarComprobante(U1, randomUUID(), png);
    expect(r.mime).toBe("image/webp");
    const meta = await sharp(await readFile(rutaSegura(r.fileKey)!)).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(2000);
  });
  it("otro formato se rechaza con un mensaje claro", async () => {
    const e = await guardarComprobante(U1, randomUUID(), Buffer.from("texto cualquiera")).catch((x) => x);
    expect(e).toBeInstanceOf(ErrorArchivo);
    expect(e.message).toBe("Usa una foto (JPG, PNG, WebP) o un PDF.");
  });
});
