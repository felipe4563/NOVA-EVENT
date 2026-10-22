"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { companySettings } from "@/db/schema";
import { ErrorArchivo, MAX_LOGO, borrarLogo, guardarLogo, type TipoLogo } from "@/lib/archivos";
import { audit, requireEquipo } from "@/lib/auth";
import { EMPRESA_POR_DEFECTO } from "@/lib/empresa";
import { enlaceRed, enlaceWeb, enlaceWhatsApp } from "@/lib/empresa-enlaces";

type Campo =
  | "nombre"
  | "lema"
  | "telefono"
  | "whatsapp"
  | "correo"
  | "direccion"
  | "ciudad"
  | "web"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "politica";

export type EstadoEmpresa =
  | { errores?: Partial<Record<Campo, string>>; error?: string; ok?: string; valores?: Partial<Record<Campo, string>> }
  | undefined;

const CAMPOS: Campo[] = ["nombre", "lema", "telefono", "whatsapp", "correo", "direccion", "ciudad", "web", "instagram", "facebook", "tiktok", "politica"];
const texto = (max: number) => z.string().trim().max(max, { error: `Máximo ${max} caracteres` });

const esquema = z
  .object({
    nombre: z.string().trim().min(2, { error: "Escribe el nombre de la empresa" }).max(80, { error: "Máximo 80 caracteres" }),
    lema: texto(120),
    telefono: texto(40),
    whatsapp: texto(40),
    correo: z.union([z.literal(""), z.email({ error: "Escribe un correo válido" }).trim().toLowerCase().max(160)]),
    direccion: texto(200),
    ciudad: texto(80),
    web: texto(200),
    instagram: texto(200),
    facebook: texto(200),
    tiktok: texto(200),
    politica: texto(3000),
  })
  .superRefine((d, ctx) => {
    const mal = (path: Campo, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (d.whatsapp && !enlaceWhatsApp(d.whatsapp)) mal("whatsapp", "Escribe el número con código de país, ej. +591 71234567");
    if (d.web && !enlaceWeb(d.web)) mal("web", "Escribe una dirección web válida, ej. novaevent.bo");
    if (d.instagram && !enlaceRed("instagram", d.instagram)) mal("instagram", "Escribe el usuario (@nova.event) o el enlace de Instagram");
    if (d.facebook && !enlaceRed("facebook", d.facebook)) mal("facebook", "Escribe el enlace o el usuario de Facebook");
    if (d.tiktok && !enlaceRed("tiktok", d.tiktok)) mal("tiktok", "Escribe el usuario (@nova.event) o el enlace de TikTok");
  });

export async function guardarEmpresa(_prev: EstadoEmpresa, formData: FormData): Promise<EstadoEmpresa> {
  const yo = await requireEquipo("empresa.editar");
  const valores = Object.fromEntries(CAMPOS.map((c) => [c, String(formData.get(c) ?? "").trim()])) as Record<Campo, string>;
  const datos = esquema.safeParse(valores);
  if (!datos.success) {
    const errores: Partial<Record<Campo, string>> = {};
    for (const i of datos.error.issues) errores[i.path[0] as Campo] ??= i.message;
    return { errores, valores };
  }
  const d = datos.data;
  const n = (s: string) => s || null;
  const fila = {
    name: d.nombre,
    tagline: n(d.lema),
    phone: n(d.telefono),
    whatsapp: n(d.whatsapp),
    email: n(d.correo),
    address: n(d.direccion),
    city: n(d.ciudad),
    website: n(d.web),
    instagram: n(d.instagram),
    facebook: n(d.facebook),
    tiktok: n(d.tiktok),
    cancellationPolicy: n(d.politica),
  };
  await db.insert(companySettings).values({ id: 1, ...fila }).onConflictDoUpdate({ target: companySettings.id, set: fila });
  await audit({ action: "empresa.guardada", userId: yo.id, entity: "empresa", entityId: "1" });
  refresh();
  return { ok: "Datos guardados. Ya se ven en las propuestas y los PDF.", valores };
}

export type EstadoLogo = { error?: string; ok?: string } | undefined;

/** Marca en la fila si hay logo propio (crea la fila con el nombre por defecto si aún no existe). */
async function marcarLogo(tipo: TipoLogo, hay: boolean) {
  const campo = tipo === "claro" ? { hasLogoLight: hay } : { hasLogoDark: hay };
  await db
    .insert(companySettings)
    .values({ id: 1, name: EMPRESA_POR_DEFECTO.name, tagline: EMPRESA_POR_DEFECTO.tagline, ...campo })
    .onConflictDoUpdate({ target: companySettings.id, set: campo });
}

export async function subirLogo(tipo: TipoLogo, _prev: EstadoLogo, formData: FormData): Promise<EstadoLogo> {
  const yo = await requireEquipo("empresa.editar");
  const archivo = formData.get("logo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige una imagen." };
  if (archivo.size > MAX_LOGO) return { error: "La imagen pesa más de 5 MB." };
  try {
    await guardarLogo(tipo, Buffer.from(await archivo.arrayBuffer()));
  } catch (e) {
    if (e instanceof ErrorArchivo) return { error: e.message };
    console.error(e);
    return { error: "No se pudo guardar el logo. Intenta de nuevo." };
  }
  await marcarLogo(tipo, true);
  await audit({ action: "empresa.logo", userId: yo.id, entity: "empresa", entityId: "1", meta: { tipo } });
  refresh();
  return { ok: tipo === "claro" ? "Logo claro actualizado (también los íconos de la app)." : "Logo oscuro actualizado." };
}

export async function restaurarLogo(tipo: TipoLogo): Promise<string | void> {
  const yo = await requireEquipo("empresa.editar");
  await borrarLogo(tipo);
  await marcarLogo(tipo, false);
  await audit({ action: "empresa.logo_restaurado", userId: yo.id, entity: "empresa", entityId: "1", meta: { tipo } });
  refresh();
}
