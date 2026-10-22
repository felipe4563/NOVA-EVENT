"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { supplierMedia, suppliers } from "@/db/schema";
import { borrarArchivos } from "@/lib/archivos";
import { audit, requireEquipo } from "@/lib/auth";
import { infoVideo } from "@/lib/videos";

export type EstadoMedia = { error?: string; ok?: string; valores?: { url?: string; titulo?: string; album?: string } } | undefined;

const titulo = z.string().trim().max(120, { error: "Máximo 120 caracteres" });
const album = z.string().trim().max(60, { error: "Máximo 60 caracteres" });

async function medio(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [m] = await db.select().from(supplierMedia).where(eq(supplierMedia.id, id));
  return m ?? null;
}

export async function agregarVideo(supplierId: string, _prev: EstadoMedia, formData: FormData): Promise<EstadoMedia> {
  const yo = await requireEquipo("proveedores.editar");
  const valores = { url: String(formData.get("url") ?? "").trim(), titulo: String(formData.get("titulo") ?? ""), album: String(formData.get("album") ?? "") };
  const video = infoVideo(valores.url);
  if (!video) return { error: "Pega un enlace de YouTube, Vimeo, TikTok o Instagram.", valores };
  const t = titulo.safeParse(valores.titulo);
  const a = album.safeParse(valores.album);
  if (!t.success || !a.success) return { error: (t.error ?? a.error)!.issues[0].message, valores };

  const [prov] = z.uuid().safeParse(supplierId).success ? await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, supplierId)) : [];
  if (!prov) return { error: "Este proveedor ya no existe.", valores };

  await db.insert(supplierMedia).values({ supplierId, kind: "video", url: valores.url, title: t.data || `Video de ${video.sitio}`, album: a.data || null, createdById: yo.id });
  await audit({ action: "galeria.video", userId: yo.id, entity: "proveedor", entityId: supplierId, meta: { url: valores.url } });
  refresh();
  return { ok: "Video agregado." };
}

export async function editarMedia(id: string, _prev: EstadoMedia, formData: FormData): Promise<EstadoMedia> {
  const yo = await requireEquipo("proveedores.editar");
  const valores = { titulo: String(formData.get("titulo") ?? ""), album: String(formData.get("album") ?? "") };
  const t = titulo.safeParse(valores.titulo);
  const a = album.safeParse(valores.album);
  if (!t.success || !a.success) return { error: (t.error ?? a.error)!.issues[0].message, valores };

  const m = await medio(id);
  if (!m) return { error: "Este archivo ya no existe.", valores };
  await db.update(supplierMedia).set({ title: t.data || null, album: a.data || null }).where(eq(supplierMedia.id, id));
  await audit({ action: "galeria.editado", userId: yo.id, entity: "proveedor", entityId: m.supplierId });
  refresh();
  return { ok: "Guardado.", valores };
}

export async function eliminarMedia(id: string): Promise<string | void> {
  const yo = await requireEquipo("proveedores.editar");
  const m = await medio(id);
  if (!m) return "Este archivo ya no existe.";
  await db.delete(supplierMedia).where(eq(supplierMedia.id, id));
  await borrarArchivos(m.fileKey, m.thumbKey);
  await audit({ action: "galeria.eliminado", userId: yo.id, entity: "proveedor", entityId: m.supplierId, meta: { tipo: m.kind, titulo: m.title } });
  refresh();
}

/** La portada es la foto que se ve en la tarjeta del proveedor; solo hay una. */
export async function marcarPortada(id: string): Promise<string | void> {
  const yo = await requireEquipo("proveedores.editar");
  const m = await medio(id);
  if (!m || m.kind === "audio" || m.kind === "video") return "Solo una foto puede ser portada.";
  await db.transaction(async (tx) => {
    await tx.update(supplierMedia).set({ isCover: false }).where(and(eq(supplierMedia.supplierId, m.supplierId), eq(supplierMedia.isCover, true)));
    await tx.update(supplierMedia).set({ isCover: true }).where(eq(supplierMedia.id, id));
  });
  await audit({ action: "galeria.portada", userId: yo.id, entity: "proveedor", entityId: m.supplierId });
  refresh();
}
