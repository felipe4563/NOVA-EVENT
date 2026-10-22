import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, notInArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  eventTypes,
  novaPackages,
  quoteItems,
  quoteVersions,
  quotes,
  roles,
  supplierBusy,
  supplierCategories,
  supplierMedia,
  supplierPackages,
  suppliers,
  users,
} from "@/db/schema";
import { totalesVersion } from "@/lib/cotizacion/calculo";
import { estadoDisponibilidad, rangosOcupados } from "@/lib/cotizacion/disponibilidad";
import { esTokenValido, leerLineaCongelada, leerVersionCongelada, listaIncluye, versionesVisibles } from "@/lib/cotizacion/propuesta";
import { contactoEmpresa, datosEmpresa } from "@/lib/empresa";
import { horario as textoHorario } from "@/lib/fechas";
import { infoVideo } from "@/lib/videos";
import { urlArchivo } from "../proveedores/datos";
import type { LineaPropuesta, Propuesta, VersionPropuesta } from "./_propuesta/tipos";

/** Tipos de evento activos, en su orden. */
export function tiposActivos() {
  return db
    .select({ id: eventTypes.id, name: eventTypes.name })
    .from(eventTypes)
    .where(eq(eventTypes.active, true))
    .orderBy(asc(eventTypes.sortOrder), asc(eventTypes.name));
}

/** Personas del equipo activas (posibles responsables de una cotización). */
export function equipoActivo() {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.active, true), eq(roles.kind, "staff")))
    .orderBy(asc(users.name));
}

/** Una cotización con sus versiones (por orden) y las líneas de cada una. null si no existe. */
export async function cargarCotizacion(id: string) {
  const [fila] = await db
    .select({ cotizacion: quotes, tipo: eventTypes.name, responsable: users.name })
    .from(quotes)
    .innerJoin(eventTypes, eq(quotes.eventTypeId, eventTypes.id))
    .leftJoin(users, eq(quotes.ownerId, users.id))
    .where(eq(quotes.id, id));
  if (!fila) return null;

  const versiones = await db.select().from(quoteVersions).where(eq(quoteVersions.quoteId, id)).orderBy(asc(quoteVersions.sortOrder), asc(quoteVersions.name));
  const lineas = versiones.length
    ? await db
        .select()
        .from(quoteItems)
        .where(inArray(quoteItems.versionId, versiones.map((v) => v.id)))
        .orderBy(asc(quoteItems.sortOrder))
    : [];
  return {
    cotizacion: fila.cotizacion,
    tipo: fila.tipo,
    responsable: fila.responsable,
    versiones: versiones.map((v) => ({ ...v, lineas: lineas.filter((l) => l.versionId === v.id) })),
  };
}

export type Disponibilidad = "libre" | "parcial" | "ocupado";
export type Horario = { inicio: string | null; fin: string | null };

export type PaqueteOpcion = { id: string; name: string; description: string | null; priceCents: number; pricing: "fixed" | "per_person" };

export type OpcionProveedor = {
  id: string;
  nombre: string;
  categoriaId: string;
  portada: string | null;
  capacidad: number | null;
  paquetes: PaqueteOpcion[];
  disponibilidad: Disponibilidad;
  /** Horarios ocupados ese día ("10:00–14:00"); vacío si está libre o todo el día ocupado. */
  rangos: string[];
  sinCapacidad: boolean;
};

const ORDEN_DISPONIBILIDAD: Record<Disponibilidad, number> = { libre: 0, parcial: 1, ocupado: 2 };

/**
 * Estado de cada proveedor para el día y horario del evento (se calcula siempre al momento).
 * `excluir`: días ocupados que no cuentan (los que creó la propia cotización al confirmar).
 * Junto al estado van los horarios ocupados, para mostrarlos si es parcial.
 */
export async function disponibilidadDe(ids: string[], fecha: string, horario: Horario, excluir: string[] = []) {
  const bloques = ids.length
    ? await db
        .select({ supplierId: supplierBusy.supplierId, startTime: supplierBusy.startTime, endTime: supplierBusy.endTime })
        .from(supplierBusy)
        .where(and(eq(supplierBusy.date, fecha), inArray(supplierBusy.supplierId, ids), excluir.length ? notInArray(supplierBusy.id, excluir) : undefined))
    : [];
  return new Map(
    ids.map((id) => {
      const propios = bloques.filter((b) => b.supplierId === id);
      return [id, { estado: estadoDisponibilidad(propios, horario), rangos: rangosOcupados(propios) }] as const;
    }),
  );
}

/** De esos paquetes de proveedor, los que siguen existiendo y activos (para volver a su precio actual). */
export async function paquetesVigentes(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const filas = await db
    .select({ id: supplierPackages.id })
    .from(supplierPackages)
    .where(and(inArray(supplierPackages.id, ids), eq(supplierPackages.active, true)));
  return new Set(filas.map((f) => f.id));
}

/** Fecha de cada día ocupado (id → AAAA-MM-DD); los que ya no existen no aparecen. */
export async function fechasDeOcupados(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const filas = await db.select({ id: supplierBusy.id, date: supplierBusy.date }).from(supplierBusy).where(inArray(supplierBusy.id, ids));
  return new Map(filas.map((f) => [f.id, f.date]));
}

/**
 * Proveedores activos que se pueden elegir (de una categoría, o de todas con null),
 * con portada, paquetes activos y disponibilidad. Libres primero, luego parciales y ocupados.
 */
export async function opcionesProveedores(categoryId: string | null, fecha: string, horario: Horario, invitados: number): Promise<OpcionProveedor[]> {
  const lista = await db
    .select({ id: suppliers.id, nombre: suppliers.name, categoriaId: suppliers.categoryId, capacidad: suppliers.capacity })
    .from(suppliers)
    .where(categoryId ? and(eq(suppliers.active, true), eq(suppliers.categoryId, categoryId)) : eq(suppliers.active, true))
    .orderBy(asc(suppliers.name));
  if (!lista.length) return [];
  const ids = lista.map((p) => p.id);
  const [estados, paquetes, portadas] = await Promise.all([
    disponibilidadDe(ids, fecha, horario),
    db
      .select({
        supplierId: supplierPackages.supplierId,
        id: supplierPackages.id,
        name: supplierPackages.name,
        description: supplierPackages.description,
        priceCents: supplierPackages.priceCents,
        pricing: supplierPackages.pricing,
      })
      .from(supplierPackages)
      .where(and(eq(supplierPackages.active, true), inArray(supplierPackages.supplierId, ids)))
      .orderBy(asc(supplierPackages.sortOrder), asc(supplierPackages.name)),
    // Portada: la marcada, o si no hay, la foto más reciente (solo la miniatura).
    db
      .selectDistinctOn([supplierMedia.supplierId], { supplierId: supplierMedia.supplierId, thumbKey: supplierMedia.thumbKey })
      .from(supplierMedia)
      .where(and(eq(supplierMedia.kind, "photo"), inArray(supplierMedia.supplierId, ids)))
      .orderBy(supplierMedia.supplierId, desc(supplierMedia.isCover), desc(supplierMedia.createdAt)),
  ]);
  const portada = new Map(portadas.map((p) => [p.supplierId, urlArchivo(p.thumbKey)]));
  return lista
    .map((p) => ({
      ...p,
      portada: portada.get(p.id) ?? null,
      paquetes: paquetes.filter((q) => q.supplierId === p.id).map((q) => ({ id: q.id, name: q.name, description: q.description, priceCents: q.priceCents, pricing: q.pricing })),
      disponibilidad: estados.get(p.id)?.estado ?? "libre",
      rangos: estados.get(p.id)?.rangos ?? [],
      sinCapacidad: p.capacidad !== null && invitados > p.capacidad,
    }))
    .sort((a, b) => ORDEN_DISPONIBILIDAD[a.disponibilidad] - ORDEN_DISPONIBILIDAD[b.disponibilidad]);
}

/** Categorías de proveedores en su orden. */
export function categoriasArmado() {
  return db
    .select({ id: supplierCategories.id, name: supplierCategories.name })
    .from(supplierCategories)
    .orderBy(asc(supplierCategories.sortOrder), asc(supplierCategories.name));
}

/** Todos los paquetes Nova (los inactivos solo se muestran si una versión ya los usa). */
export function paquetesNova() {
  return db
    .select({ id: novaPackages.id, name: novaPackages.name, priceCents: novaPackages.priceCents, active: novaPackages.active })
    .from(novaPackages)
    .orderBy(asc(novaPackages.sortOrder), asc(novaPackages.name));
}

/** Nombre, capacidad y estado de los proveedores de las líneas (aunque estén inactivos). */
export function proveedoresDeLineas(ids: string[]) {
  return ids.length
    ? db
        .select({ id: suppliers.id, name: suppliers.name, capacity: suppliers.capacity, active: suppliers.active })
        .from(suppliers)
        .where(inArray(suppliers.id, ids))
    : Promise.resolve([]);
}

type Medios = Pick<LineaPropuesta, "portada" | "fotos" | "pano" | "audio" | "video">;
const SIN_MEDIOS: Medios = { portada: null, fotos: [], pano: null, audio: null, video: null };

/** Portada, hasta 6 fotos/planos, la primera 360°, el primer audio y el primer video de cada proveedor. */
async function mediosDe(ids: string[], url: (clave: string) => string): Promise<Map<string, Medios>> {
  if (!ids.length) return new Map();
  const filas = await db
    .select({
      id: supplierMedia.id,
      supplierId: supplierMedia.supplierId,
      kind: supplierMedia.kind,
      fileKey: supplierMedia.fileKey,
      thumbKey: supplierMedia.thumbKey,
      width: supplierMedia.width,
      height: supplierMedia.height,
      url: supplierMedia.url,
    })
    .from(supplierMedia)
    .where(inArray(supplierMedia.supplierId, ids))
    // Como en la galería: la portada primero, luego lo más nuevo.
    .orderBy(desc(supplierMedia.isCover), desc(supplierMedia.createdAt));
  return new Map(
    ids.map((id) => {
      const propias = filas.filter((m) => m.supplierId === id);
      const portada = propias.find((m) => m.kind === "photo" && (m.fileKey || m.thumbKey));
      const fotos = propias
        .filter((m) => (m.kind === "photo" || m.kind === "plan") && m.id !== portada?.id && m.fileKey)
        .slice(0, 6)
        // Sin título: es un dato interno de la galería (puede decir cualquier cosa) y la propuesta la ve el cliente.
        .map((m) => ({ src: url(m.fileKey!), miniatura: url(m.thumbKey ?? m.fileKey!), titulo: null }));
      const pano = propias.find((m) => m.kind === "pano" && m.fileKey);
      const audio = propias.find((m) => m.kind === "audio" && m.fileKey);
      const video = propias.map((m) => (m.kind === "video" && m.url ? infoVideo(m.url) : null)).find((v) => v !== null) ?? null;
      const medios: Medios = {
        portada: portada ? url((portada.fileKey ?? portada.thumbKey)!) : null,
        fotos,
        pano: pano ? { src: url(pano.fileKey!), ancho: pano.width ?? 2, alto: pano.height ?? 1 } : null,
        audio: audio ? url(audio.fileKey!) : null,
        video,
      };
      return [id, medios] as const;
    }),
  );
}

/**
 * Lo que ven los novios. Solo las versiones marcadas «mostrar en la propuesta»;
 * si está aceptada, solo la aceptada con sus copias congeladas. Nunca notas, contactos ni agenda.
 * Las direcciones de archivos se arman con `url` (en el panel /archivos, en el enlace público la ruta con token).
 */
export async function datosPropuesta(quoteId: string, url: (clave: string) => string): Promise<Propuesta | null> {
  const datos = await cargarCotizacion(quoteId);
  if (!datos) return null;
  const { cotizacion: c, tipo } = datos;
  const versiones = versionesVisibles(c, datos.versiones);
  const aceptada = c.status === "accepted" ? versiones[0] : undefined;
  const lineas = versiones.flatMap((v) => v.lineas);
  const idsProv = [...new Set(lineas.flatMap((l) => (l.supplierId ? [l.supplierId] : [])))];
  const idsPaq = [...new Set(lineas.flatMap((l) => (l.supplierPackageId ? [l.supplierPackageId] : [])))];

  const [categorias, provs, paquetes, nova, medios] = await Promise.all([
    categoriasArmado(),
    proveedoresDeLineas(idsProv),
    idsPaq.length
      ? db
          .select({ id: supplierPackages.id, name: supplierPackages.name, description: supplierPackages.description })
          .from(supplierPackages)
          .where(inArray(supplierPackages.id, idsPaq))
      : Promise.resolve([]),
    // Son pocos: se traen todos para conocer también el nombre del paquete base.
    db
      .select({
        id: novaPackages.id,
        name: novaPackages.name,
        priceCents: novaPackages.priceCents,
        tagline: novaPackages.tagline,
        includes: novaPackages.includes,
        basePackageId: novaPackages.basePackageId,
        theme: novaPackages.theme,
      })
      .from(novaPackages),
    mediosDe(idsProv, url),
  ]);
  const nombreProv = new Map(provs.map((p) => [p.id, p.name]));
  const paquete = new Map(paquetes.map((p) => [p.id, p]));
  const novaPorId = new Map(nova.map((p) => [p.id, p]));
  const categoria = new Map(categorias.map((k, i) => [k.id, { nombre: k.name, orden: i }]));

  const armarVersion = (v: (typeof versiones)[number]): VersionPropuesta => {
    const congelada = v === aceptada;
    const grupos = new Map<string, { categoria: string; orden: number; lineas: LineaPropuesta[] }>();
    for (const l of v.lineas) {
      // Aceptada: nombres y montos de la copia congelada (si todavía no existe, los actuales).
      const f = congelada ? leerLineaCongelada(l.frozen) : null;
      const paq = l.supplierPackageId ? paquete.get(l.supplierPackageId) : undefined;
      const linea: LineaPropuesta = {
        proveedor: f ? f.proveedor : l.supplierId ? (nombreProv.get(l.supplierId) ?? null) : null,
        paquete: f ? f.paquete : (paq?.name ?? null),
        descripcion: paq?.description ?? null,
        etiqueta: f?.etiqueta ?? l.label,
        total: f?.total ?? l.totalCents,
        ...((l.supplierId && medios.get(l.supplierId)) || SIN_MEDIOS),
      };
      // Categorías en su orden; al final lo que no tiene categoría.
      const k = l.categoryId ? categoria.get(l.categoryId) : undefined;
      const clave = k ? l.categoryId! : "";
      const g = grupos.get(clave) ?? { categoria: k?.nombre ?? "Otros servicios", orden: k?.orden ?? Number.MAX_SAFE_INTEGER, lineas: [] };
      g.lineas.push(linea);
      grupos.set(clave, g);
    }
    const secciones = [...grupos.values()].sort((a, b) => a.orden - b.orden).map((g) => ({ categoria: g.categoria, lineas: g.lineas }));

    const p = v.novaPackageId ? novaPorId.get(v.novaPackageId) : undefined;
    const fz = congelada ? leerVersionCongelada(v.frozen) : null;
    const novaV: VersionPropuesta["nova"] = fz
      ? { nombre: fz.nombre, precio: fz.precio, frase: fz.frase, incluye: fz.incluye, theme: p?.theme ?? "vino" }
      : p
        ? {
            nombre: p.name,
            precio: v.novaPriceCents ?? p.priceCents,
            frase: p.tagline,
            incluye: listaIncluye(p.basePackageId ? (novaPorId.get(p.basePackageId)?.name ?? null) : null, p.includes),
            theme: p.theme,
          }
        : null;
    return {
      id: v.id,
      nombre: v.name,
      nova: novaV,
      secciones,
      totales: totalesVersion(
        secciones.flatMap((s) => s.lineas),
        novaV?.precio ?? null,
      ),
    };
  };

  return {
    codigo: c.code,
    cliente: c.clientName,
    tipo,
    fecha: c.eventDate,
    horario: c.startTime && c.endTime ? textoHorario(c.startTime, c.endTime) : null,
    invitados: c.guests,
    validez: c.validUntil,
    mostrarPresupuesto: c.showBudgetToClient,
    presupuesto: c.showBudgetToClient ? c.budgetCents : null,
    incluyeNovaEnPresupuesto: c.includeNovaInBudget,
    versiones: versiones.map(armarVersion),
    proveedoresVisibles: idsProv,
    empresa: contactoEmpresa(await datosEmpresa(), `Hola, les escribo por la propuesta ${c.code}`),
  };
}

/** Cotización con el enlace público activo para ese token; null si el token no tiene el formato, no existe o está desactivado. */
export async function cotizacionCompartida(token: string) {
  if (!esTokenValido(token)) return null;
  const [c] = await db
    .select({ id: quotes.id, status: quotes.status, acceptedVersionId: quotes.acceptedVersionId })
    .from(quotes)
    .where(and(eq(quotes.shareToken, token), eq(quotes.shareEnabled, true)));
  return c ?? null;
}

/**
 * Proveedores que muestra la propuesta (mismas versiones que datosPropuesta), sin armarla entera:
 * lo usa la ruta de archivos del enlace público en cada pedido.
 */
export async function proveedoresVisiblesDe(c: { id: string; status: string; acceptedVersionId: string | null }): Promise<string[]> {
  const todas = await db.select({ id: quoteVersions.id, showInProposal: quoteVersions.showInProposal }).from(quoteVersions).where(eq(quoteVersions.quoteId, c.id));
  const ids = versionesVisibles(c, todas).map((v) => v.id);
  if (!ids.length) return [];
  const filas = await db
    .selectDistinct({ supplierId: quoteItems.supplierId })
    .from(quoteItems)
    .where(and(inArray(quoteItems.versionId, ids), isNotNull(quoteItems.supplierId)));
  return filas.flatMap((f) => (f.supplierId ? [f.supplierId] : []));
}

/** ¿La clave es un archivo (o miniatura) de la galería de alguno de esos proveedores? */
export async function esArchivoDeGaleria(clave: string, proveedores: string[]): Promise<boolean> {
  if (!proveedores.length) return false;
  const [fila] = await db
    .select({ id: supplierMedia.id })
    .from(supplierMedia)
    .where(and(inArray(supplierMedia.supplierId, proveedores), or(eq(supplierMedia.fileKey, clave), eq(supplierMedia.thumbKey, clave))))
    .limit(1);
  return Boolean(fila);
}
