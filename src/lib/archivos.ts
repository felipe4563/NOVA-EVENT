/**
 * Archivos subidos (galería de proveedores). Se guardan en UPLOADS_DIR:
 * en Docker es un volumen (/app/uploads) que hay que incluir en los respaldos.
 * Sin dependencias de Next: también lo usa el script de datos de ejemplo.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const DIR_ARCHIVOS = path.resolve(process.env.UPLOADS_DIR || "uploads");

export const MAX_IMAGEN = 30 * 1024 * 1024;
export const MAX_AUDIO = 20 * 1024 * 1024;
export const MAX_COMPROBANTE = 10 * 1024 * 1024;

/**
 * Ruta relativa válida: proveedores/<uuid>/<uuid>[_min].<ext> (galería) o
 * pagos/<uuid>/<uuid>.(webp|pdf) (comprobantes). Evita salirse de la carpeta.
 */
const RE_RUTA = /^(proveedores\/[0-9a-f-]{36}\/[0-9a-f-]{36}(_min)?\.(webp|mp3|m4a|ogg|wav)|pagos\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|pdf))$/;

export const TIPOS_CONTENIDO: Record<string, string> = {
  webp: "image/webp",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
  pdf: "application/pdf",
};

/** Solo los archivos de la galería de proveedores se sirven con los permisos de galería; los comprobantes no. */
export function esClaveGaleria(clave: string): boolean {
  return clave.startsWith("proveedores/") && rutaSegura(clave) !== null;
}

export function rutaSegura(clave: string) {
  return RE_RUTA.test(clave) ? path.join(DIR_ARCHIVOS, ...clave.split("/")) : null;
}

/** Contenido de un archivo subido; null si la clave no es válida o el archivo no existe. */
export async function leerArchivo(clave: string): Promise<Buffer | null> {
  const ruta = rutaSegura(clave);
  return ruta ? readFile(ruta).catch(() => null) : null;
}

export function carpetaProveedor(supplierId: string) {
  return `proveedores/${supplierId}`;
}

async function guardar(clave: string, datos: Buffer) {
  const destino = rutaSegura(clave);
  if (!destino) throw new Error(`Ruta de archivo no válida: ${clave}`);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, datos);
}

export async function borrarArchivos(...claves: (string | null)[]) {
  for (const c of claves) {
    const ruta = c ? rutaSegura(c) : null;
    if (ruta) await rm(ruta, { force: true });
  }
}

export async function borrarCarpetaProveedor(supplierId: string) {
  if (!/^[0-9a-f-]{36}$/.test(supplierId)) return;
  await rm(path.join(DIR_ARCHIVOS, "proveedores", supplierId), { recursive: true, force: true });
}

export type TipoImagen = "photo" | "plan" | "pano";

export type ArchivoGuardado = {
  fileKey: string;
  thumbKey: string | null;
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
};

/**
 * Optimiza una imagen y su miniatura (WebP, sin datos de ubicación ni de cámara).
 * Las 360° se dejan en 4096 px de ancho: es lo máximo que muestran bien la mayoría de celulares.
 */
export async function guardarImagen(supplierId: string, id: string, tipo: TipoImagen, datos: Buffer): Promise<ArchivoGuardado> {
  const base = sharp(datos, { failOn: "error" }).rotate();
  const meta = await base.metadata().catch(() => null);
  if (!meta?.width || !meta.height) throw new ErrorArchivo("No se pudo leer la imagen. Usa JPG, PNG o WebP.");

  const ancho = tipo === "pano" ? 4096 : 2000;
  const { data, info } = await base
    .clone()
    .resize({ width: ancho, height: tipo === "pano" ? undefined : ancho, fit: "inside", withoutEnlargement: true })
    .webp({ quality: tipo === "plan" ? 90 : 82 })
    .toBuffer({ resolveWithObject: true });
  const miniatura = await base.clone().resize({ width: 640, height: 480, fit: "cover" }).webp({ quality: 72 }).toBuffer();

  const carpeta = carpetaProveedor(supplierId);
  const fileKey = `${carpeta}/${id}.webp`;
  const thumbKey = `${carpeta}/${id}_min.webp`;
  await guardar(fileKey, data);
  await guardar(thumbKey, miniatura);
  return { fileKey, thumbKey, mime: "image/webp", sizeBytes: data.length, width: info.width, height: info.height };
}

/** Reconoce el formato por su contenido, no por el nombre. */
function formatoAudio(d: Buffer): "mp3" | "m4a" | "ogg" | "wav" | null {
  if (d.subarray(0, 3).toString("latin1") === "ID3" || (d[0] === 0xff && (d[1] & 0xe0) === 0xe0)) return "mp3";
  if (d.subarray(4, 8).toString("latin1") === "ftyp") return "m4a";
  if (d.subarray(0, 4).toString("latin1") === "OggS") return "ogg";
  if (d.subarray(0, 4).toString("latin1") === "RIFF" && d.subarray(8, 12).toString("latin1") === "WAVE") return "wav";
  return null;
}

export async function guardarAudio(supplierId: string, id: string, datos: Buffer): Promise<ArchivoGuardado> {
  const ext = formatoAudio(datos);
  if (!ext) throw new ErrorArchivo("Formato de audio no reconocido. Usa MP3, M4A, OGG o WAV.");
  const fileKey = `${carpetaProveedor(supplierId)}/${id}.${ext}`;
  await guardar(fileKey, datos);
  return { fileKey, thumbKey: null, mime: TIPOS_CONTENIDO[ext], sizeBytes: datos.length, width: null, height: null };
}

/** Comprobante de pago: foto (→ WebP de 2000 px) o PDF, que se guarda tal cual. */
export async function guardarComprobante(quoteId: string, id: string, datos: Buffer): Promise<{ fileKey: string; mime: string }> {
  const carpeta = `pagos/${quoteId}`;
  if (datos.subarray(0, 5).toString("latin1") === "%PDF-") {
    const fileKey = `${carpeta}/${id}.pdf`;
    await guardar(fileKey, datos);
    return { fileKey, mime: TIPOS_CONTENIDO.pdf };
  }
  const base = sharp(datos, { failOn: "error" }).rotate();
  const meta = await base.metadata().catch(() => null);
  if (!meta?.width || !meta.height) throw new ErrorArchivo("Usa una foto (JPG, PNG, WebP) o un PDF.");
  const webp = await base.resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const fileKey = `${carpeta}/${id}.webp`;
  await guardar(fileKey, webp);
  return { fileKey, mime: TIPOS_CONTENIDO.webp };
}

/** Error que se puede mostrar tal cual a la persona. */
export class ErrorArchivo extends Error {}

/* ── Marca: logos de la empresa e íconos de la app ───────────── */

/**
 * Archivos de marca con nombre fijo en UPLOADS_DIR/empresa. Si no se subió uno,
 * se entrega el de respaldo que viene con la app (carpeta public/).
 */
export const ARCHIVOS_MARCA = {
  "logo-claro.webp": { tipo: "image/webp", respaldo: "brand/logo-transparente.webp" },
  "logo-oscuro.webp": { tipo: "image/webp", respaldo: "brand/logo-oscuro.webp" },
  "icono-192.png": { tipo: "image/png", respaldo: "icon-192.png" },
  "icono-512.png": { tipo: "image/png", respaldo: "icon-512.png" },
  "icono-maskable-512.png": { tipo: "image/png", respaldo: "icon-maskable-512.png" },
  "apple-icon.png": { tipo: "image/png", respaldo: "apple-icon.png" },
} as const;

export type ArchivoMarca = keyof typeof ARCHIVOS_MARCA;
export type TipoLogo = "claro" | "oscuro";

export const MAX_LOGO = 5 * 1024 * 1024;

export function esArchivoMarca(nombre: string): nombre is ArchivoMarca {
  return Object.hasOwn(ARCHIVOS_MARCA, nombre);
}

/** Ruta del archivo subido y del de respaldo. */
export function rutasMarca(nombre: ArchivoMarca) {
  return {
    subida: path.join(DIR_ARCHIVOS, "empresa", nombre),
    respaldo: path.join(process.cwd(), "public", ...ARCHIVOS_MARCA[nombre].respaldo.split("/")),
  };
}

/** Fondo de los íconos de la app (crema de la marca). */
const FONDO_ICONO = { r: 251, g: 246, b: 243, alpha: 1 };

/** Ícono cuadrado con el logo centrado; `margen` es la parte libre alrededor (0.16 = 16 %). */
async function icono(logo: Buffer, lado: number, margen: number) {
  const interior = Math.round(lado * (1 - margen * 2));
  const centro = await sharp(logo).resize(interior, interior, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: lado, height: lado, channels: 4, background: FONDO_ICONO } })
    .composite([{ input: centro, gravity: "center" }])
    .png()
    .toBuffer();
}

/**
 * Guarda un logo optimizado (WebP con transparencia, máx. 1200 px de ancho).
 * El logo claro además genera los íconos de la app (192, 512, maskable y Apple).
 */
export async function guardarLogo(tipo: TipoLogo, datos: Buffer) {
  const base = sharp(datos, { failOn: "error" }).rotate();
  const meta = await base.metadata().catch(() => null);
  if (!meta?.width || !meta.height) throw new ErrorArchivo("No se pudo leer la imagen. Usa PNG, WebP o JPG (mejor PNG con fondo transparente).");

  const logo = await base.clone().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
  const carpeta = path.join(DIR_ARCHIVOS, "empresa");
  await mkdir(carpeta, { recursive: true });
  await writeFile(path.join(carpeta, `logo-${tipo}.webp`), logo);

  if (tipo === "claro") {
    const piezas: [ArchivoMarca, number, number][] = [
      ["icono-192.png", 192, 0.08],
      ["icono-512.png", 512, 0.08],
      ["icono-maskable-512.png", 512, 0.2],
      ["apple-icon.png", 180, 0.1],
    ];
    for (const [nombre, lado, margen] of piezas) await writeFile(path.join(carpeta, nombre), await icono(logo, lado, margen));
  }
}

/** Vuelve al logo original de la app (borra el subido y, si es el claro, sus íconos). */
export async function borrarLogo(tipo: TipoLogo) {
  const nombres: ArchivoMarca[] =
    tipo === "claro" ? ["logo-claro.webp", "icono-192.png", "icono-512.png", "icono-maskable-512.png", "apple-icon.png"] : ["logo-oscuro.webp"];
  for (const n of nombres) await rm(rutasMarca(n).subida, { force: true });
}
