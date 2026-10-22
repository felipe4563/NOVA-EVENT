/**
 * Arma los enlaces de contacto de la empresa a partir de lo que se escribe en Ajustes:
 * "@nova.event", "instagram.com/nova.event" o la dirección completa sirven igual.
 */
export type Red = "instagram" | "facebook" | "tiktok";

const DOMINIOS: Record<Red, string> = {
  instagram: "instagram.com",
  facebook: "facebook.com",
  tiktok: "tiktok.com",
};

const RE_USUARIO = /^[\w.-]{1,60}$/;

/** Enlace a la red social, o null si el texto no se entiende. */
export function enlaceRed(red: Red, valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  const dominio = DOMINIOS[red];

  // Dirección completa o con el dominio: se acepta solo si es de esa red.
  if (v.includes("/") || v.includes(dominio)) {
    const url = URL.parse(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) return null;
    const host = url.hostname.replace(/^(www\.|m\.)/, "");
    if (host !== dominio) return null;
    const ruta = url.pathname.replace(/\/+$/, "");
    return ruta ? `https://${dominio}${ruta}` : null;
  }

  // Solo el usuario: "@nova.event" o "nova.event".
  const usuario = v.replace(/^@/, "");
  if (!RE_USUARIO.test(usuario)) return null;
  return `https://${dominio}/${red === "tiktok" ? "@" : ""}${usuario}`;
}

/** Texto corto para mostrar la red: "@nova.event". */
export function usuarioRed(enlace: string): string {
  const ultimo = new URL(enlace).pathname.split("/").filter(Boolean).at(-1) ?? "";
  return ultimo.startsWith("@") ? ultimo : `@${ultimo}`;
}

/** Enlace de WhatsApp (wa.me) con el número solo en dígitos, o null si no hay número válido. */
export function enlaceWhatsApp(numero: string | null | undefined, mensaje?: string): string | null {
  const digitos = (numero ?? "").replace(/\D/g, "");
  if (digitos.length < 8 || digitos.length > 15) return null;
  return `https://wa.me/${digitos}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}

/** Enlace web normal (http/https), o null. */
export function enlaceWeb(valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  const url = URL.parse(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  return url && (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".") ? url.toString() : null;
}

/** Teléfono para el enlace tel: (dígitos y +). */
export function enlaceTelefono(numero: string | null | undefined): string | null {
  const t = (numero ?? "").replace(/[^\d+]/g, "");
  return t.replace(/\D/g, "").length >= 6 ? `tel:${t}` : null;
}
