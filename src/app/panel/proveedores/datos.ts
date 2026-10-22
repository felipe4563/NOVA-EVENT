import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { supplierCategories, supplierMedia } from "@/db/schema";
import { infoVideo } from "@/lib/videos";
import type { ItemGaleria } from "./_galeria/tipos";

/** Categorías en el orden en que se muestran. */
export function categoriasOrdenadas() {
  return db
    .select({ id: supplierCategories.id, name: supplierCategories.name })
    .from(supplierCategories)
    .orderBy(asc(supplierCategories.sortOrder), asc(supplierCategories.name));
}

/** Dirección pública (con sesión) de un archivo subido. */
export function urlArchivo(clave: string | null) {
  return clave ? `/archivos/${clave}` : null;
}

/** Galería de un proveedor lista para mostrar: la portada primero, luego lo más nuevo. */
export async function galeriaDe(supplierId: string): Promise<ItemGaleria[]> {
  const filas = await db
    .select()
    .from(supplierMedia)
    .where(eq(supplierMedia.supplierId, supplierId))
    .orderBy(desc(supplierMedia.isCover), desc(supplierMedia.createdAt));
  return filas.map((m) => ({
    id: m.id,
    kind: m.kind,
    title: m.title,
    album: m.album,
    src: urlArchivo(m.fileKey),
    thumb: urlArchivo(m.thumbKey),
    width: m.width,
    height: m.height,
    isCover: m.isCover,
    url: m.url,
    video: m.kind === "video" && m.url ? infoVideo(m.url) : null,
  }));
}
