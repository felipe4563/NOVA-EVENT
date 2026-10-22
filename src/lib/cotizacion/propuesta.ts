// Ayudantes puros para la propuesta de cotización.

/** (2026, 7) -> "COT-2026-0007". */
export function codigoCotizacion(anio: number, correlativo: number): string {
  return `COT-${anio}-${String(correlativo).padStart(4, "0")}`;
}

/** Claves de archivo ("proveedores/<id>/…") cuyo proveedor es visible. */
export function archivosPermitidos(proveedoresVisibles: string[], claves: string[]): Set<string> {
  const visibles = new Set(proveedoresVisibles);
  return new Set(claves.filter((c) => {
    const proveedor = c.split("/")[1];
    return proveedor !== undefined && visibles.has(proveedor);
  }));
}

/**
 * Versiones que ve el cliente (propuesta, enlace público y sus archivos):
 * si está aceptada, solo la versión aceptada (si no se encuentra, ninguna; nunca las demás);
 * si no, las marcadas «mostrar en la propuesta».
 */
export function versionesVisibles<V extends { id: string; showInProposal: boolean }>(
  cotizacion: { status: string; acceptedVersionId: string | null },
  versiones: V[],
): V[] {
  if (cotizacion.status === "accepted") return versiones.filter((v) => v.id === cotizacion.acceptedVersionId);
  return versiones.filter((v) => v.showInProposal);
}

/** Token del enlace público: randomBytes(24) en base64url = 32 caracteres. Se revisa antes de consultar la base. */
export function esTokenValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(token);
}

export type LineaCongelada = { proveedor: string | null; paquete: string | null; etiqueta: string; total: number };

/** Copia plana (solo los 4 campos) para la propuesta enviada. */
export function congelarLinea(l: LineaCongelada): LineaCongelada {
  return { proveedor: l.proveedor, paquete: l.paquete, etiqueta: l.etiqueta, total: l.total };
}

/** Lee la copia congelada de una línea (jsonb); null si falta o no tiene la forma esperada. */
export function leerLineaCongelada(v: unknown): LineaCongelada | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const texto = (x: unknown) => (typeof x === "string" ? x : null);
  if (typeof o.etiqueta !== "string" || typeof o.total !== "number" || !Number.isInteger(o.total)) return null;
  return { proveedor: texto(o.proveedor), paquete: texto(o.paquete), etiqueta: o.etiqueta, total: o.total };
}

/** Lista "Incluye" del paquete Nova: si hereda de otro, primero "Todo lo del paquete X". */
export function listaIncluye(base: string | null, incluye: string[]): string[] {
  const propios = incluye.map((t) => t.trim()).filter(Boolean);
  return base ? [`Todo lo del paquete ${base}`, ...propios] : propios;
}

export type NovaCongelado = { nombre: string; precio: number; frase: string | null; incluye: string[] };

/** Lee la copia congelada del paquete Nova de una versión (jsonb); null si falta o no tiene la forma esperada. */
export function leerVersionCongelada(v: unknown): NovaCongelado | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.nombre !== "string" || typeof o.precio !== "number" || !Number.isInteger(o.precio)) return null;
  if (o.frase !== null && o.frase !== undefined && typeof o.frase !== "string") return null;
  if (!Array.isArray(o.incluye) || !o.incluye.every((t) => typeof t === "string")) return null;
  return { nombre: o.nombre, precio: o.precio, frase: typeof o.frase === "string" ? o.frase : null, incluye: [...o.incluye] };
}
