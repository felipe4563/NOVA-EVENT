import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companySettings } from "@/db/schema";
import { enlaceRed, enlaceTelefono, enlaceWeb, enlaceWhatsApp, usuarioRed } from "./empresa-enlaces";

export const EMPRESA_POR_DEFECTO = {
  name: "Nova Event",
  tagline: "Tú sueñas, nosotros lo hacemos realidad",
};

/** Datos de la empresa tal como se guardaron (con nombre y lema por defecto si aún no se configuró). */
export const datosEmpresa = cache(async () => {
  const [fila] = await db.select().from(companySettings).where(eq(companySettings.id, 1));
  return {
    name: fila?.name ?? EMPRESA_POR_DEFECTO.name,
    tagline: fila ? fila.tagline : EMPRESA_POR_DEFECTO.tagline,
    phone: fila?.phone ?? null,
    whatsapp: fila?.whatsapp ?? null,
    email: fila?.email ?? null,
    address: fila?.address ?? null,
    city: fila?.city ?? null,
    website: fila?.website ?? null,
    instagram: fila?.instagram ?? null,
    facebook: fila?.facebook ?? null,
    tiktok: fila?.tiktok ?? null,
    /** Política de cambios y cancelación (texto libre). */
    politica: fila?.cancellationPolicy ?? null,
    hasLogoLight: fila?.hasLogoLight ?? false,
    hasLogoDark: fila?.hasLogoDark ?? false,
    /** Para refrescar las vistas previas del logo cuando cambia. */
    updatedAt: fila?.updatedAt ?? null,
  };
});

export type DatosEmpresa = Awaited<ReturnType<typeof datosEmpresa>>;

/** Lo que ven los clientes (propuesta, enlace, PDF): solo enlaces válidos y textos listos. */
export type ContactoEmpresa = {
  nombre: string;
  lema: string | null;
  telefono: { texto: string; enlace: string } | null;
  whatsapp: { texto: string; enlace: string } | null;
  correo: string | null;
  direccion: string | null;
  web: { texto: string; enlace: string } | null;
  redes: { red: "Instagram" | "Facebook" | "TikTok"; usuario: string; enlace: string }[];
};

export function contactoEmpresa(e: DatosEmpresa, mensajeWhatsApp?: string): ContactoEmpresa {
  const tel = enlaceTelefono(e.phone);
  const wa = enlaceWhatsApp(e.whatsapp, mensajeWhatsApp);
  const web = enlaceWeb(e.website);
  const redes = (
    [
      ["Instagram", enlaceRed("instagram", e.instagram)],
      ["Facebook", enlaceRed("facebook", e.facebook)],
      ["TikTok", enlaceRed("tiktok", e.tiktok)],
    ] as const
  ).flatMap(([red, enlace]) => (enlace ? [{ red, usuario: usuarioRed(enlace), enlace }] : []));
  return {
    nombre: e.name,
    lema: e.tagline,
    telefono: tel && e.phone ? { texto: e.phone, enlace: tel } : null,
    whatsapp: wa && e.whatsapp ? { texto: e.whatsapp, enlace: wa } : null,
    correo: e.email,
    direccion: [e.address, e.city].filter(Boolean).join(", ") || null,
    web: web && e.website ? { texto: e.website.replace(/^https?:\/\//i, "").replace(/\/$/, ""), enlace: web } : null,
    redes,
  };
}
