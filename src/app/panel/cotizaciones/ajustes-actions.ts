"use server";

import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { eventTypes, novaPackages, quotes } from "@/db/schema";
import { audit, requireEquipo } from "@/lib/auth";
import { aCentavos } from "@/lib/cotizacion/dinero";

/* ── Paquetes Nova ──────────────────────────────────────────── */

type CampoPaquete = "nombre" | "precio" | "frase" | "descripcion" | "incluye" | "base" | "tema";

export type EstadoPaquete =
  | {
      errores?: Partial<Record<CampoPaquete, string>>;
      error?: string;
      ok?: string;
      valores?: Partial<Record<CampoPaquete, string>> & { activo?: boolean };
    }
  | undefined;

const CAMPOS: CampoPaquete[] = ["nombre", "precio", "frase", "descripcion", "incluye", "base", "tema"];

const esquema = z.object({
  nombre: z.string().trim().min(2, { error: "Escribe el nombre (mínimo 2 letras)" }).max(60, { error: "Máximo 60 caracteres" }),
  frase: z.string().trim().max(160, { error: "Máximo 160 caracteres" }),
  descripcion: z.string().trim().max(600, { error: "Máximo 600 caracteres" }),
  tema: z.enum(["vino", "oro", "agua"], { error: "Elige un color" }),
});

const esUuid = (v: string) => z.uuid().safeParse(v).success;

function erroresDe(e: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

/** Un ítem por renglón: sin espacios sobrantes ni renglones vacíos. */
function listaIncluye(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

async function paqueteRepetido(nombre: string, exceptoId?: string) {
  const [p] = await db
    .select({ id: novaPackages.id })
    .from(novaPackages)
    .where(and(sql`lower(${novaPackages.name}) = ${nombre.toLowerCase()}`, exceptoId ? ne(novaPackages.id, exceptoId) : undefined))
    .limit(1);
  return Boolean(p);
}

/** Sigue la cadena de bases desde `baseId`; hay ciclo si llega a `id`. */
async function creaCiclo(id: string, baseId: string) {
  const filas = await db.select({ id: novaPackages.id, base: novaPackages.basePackageId }).from(novaPackages);
  const base = new Map(filas.map((f) => [f.id, f.base]));
  const visto = new Set<string>();
  let actual: string | null | undefined = baseId;
  while (actual && !visto.has(actual)) {
    if (actual === id) return true;
    visto.add(actual);
    actual = base.get(actual);
  }
  return false;
}

export async function guardarPaqueteNova(id: string | null, _prev: EstadoPaquete, formData: FormData): Promise<EstadoPaquete> {
  const yo = await requireEquipo("cotizaciones.editar");
  const valores: NonNullable<EstadoPaquete>["valores"] = { activo: formData.get("activo") === "on" };
  for (const c of CAMPOS) valores[c] = String(formData.get(c) ?? "").trim();
  // El textarea conserva sus renglones; solo se recorta el borde.
  valores.incluye = String(formData.get("incluye") ?? "");
  if (id !== null && !esUuid(id)) return { error: "Este paquete ya no existe.", valores };

  const datos = esquema.safeParse(valores);
  const errores: Partial<Record<CampoPaquete, string>> = datos.success ? {} : erroresDe(datos.error);

  const precio = aCentavos(valores.precio ?? "");
  if (precio === null || precio <= 0) errores.precio = "Escribe un precio mayor que 0. Ej. 6.000";

  const incluye = listaIncluye(valores.incluye);
  if (incluye.length > 40) errores.incluye = "Máximo 40 ítems";
  else if (incluye.some((l) => l.length > 200)) errores.incluye = "Cada ítem admite máximo 200 caracteres";

  const baseId = valores.base || null;
  if (baseId) {
    if (!z.uuid().safeParse(baseId).success) errores.base = "Elige un paquete válido";
    else if (id && baseId === id) errores.base = "Un paquete no puede incluirse a sí mismo";
    else {
      const [b] = await db.select({ id: novaPackages.id }).from(novaPackages).where(eq(novaPackages.id, baseId));
      if (!b) errores.base = "Ese paquete ya no existe";
      else if (id && (await creaCiclo(id, baseId))) errores.base = "Crearía un ciclo: ese paquete ya incluye a este";
    }
  }

  if (!datos.success || Object.keys(errores).length) return { errores, valores };
  if (await paqueteRepetido(datos.data.nombre, id ?? undefined)) return { errores: { nombre: "Ya hay un paquete con este nombre" }, valores };

  const fila = {
    name: datos.data.nombre,
    priceCents: precio!,
    tagline: datos.data.frase || null,
    description: datos.data.descripcion || null,
    includes: incluye,
    basePackageId: baseId,
    theme: datos.data.tema,
    active: valores.activo ?? false,
  };

  if (id) {
    const r = await db.update(novaPackages).set(fila).where(eq(novaPackages.id, id)).returning({ id: novaPackages.id });
    if (!r.length) return { error: "Este paquete ya no existe.", valores };
  } else {
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${novaPackages.sortOrder}), 0)` }).from(novaPackages);
    const [nuevo] = await db.insert(novaPackages).values({ ...fila, sortOrder: Number(max) + 1 }).returning({ id: novaPackages.id });
    id = nuevo.id;
  }
  await audit({ action: "paqueteNova.guardado", userId: yo.id, entity: "paqueteNova", entityId: id, meta: { nombre: fila.name } });
  refresh();
  return { ok: "Paquete guardado.", valores: { ...valores, incluye: incluye.join("\n") } };
}

export async function eliminarPaqueteNova(id: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  if (!esUuid(id)) return "Este paquete ya no existe.";
  const [borrado] = await db.delete(novaPackages).where(eq(novaPackages.id, id)).returning({ name: novaPackages.name });
  if (!borrado) return "Este paquete ya no existe.";
  await audit({ action: "paqueteNova.eliminado", userId: yo.id, entity: "paqueteNova", entityId: id, meta: { nombre: borrado.name } });
  refresh();
}

/** Sube o baja un paquete un lugar en el orden (intercambia con su vecino). */
export async function moverPaqueteNova(id: string, direccion: "arriba" | "abajo"): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  const resultado = await db.transaction(async (tx) => {
    const filas = await tx
      .select({ id: novaPackages.id, sortOrder: novaPackages.sortOrder })
      .from(novaPackages)
      .orderBy(asc(novaPackages.sortOrder), asc(novaPackages.name))
      .for("update");
    const i = filas.findIndex((f) => f.id === id);
    if (i < 0) return "Este paquete ya no existe.";
    const j = direccion === "arriba" ? i - 1 : i + 1;
    if (j < 0 || j >= filas.length) return "extremo"; // ya está en el extremo: nada que mover ni auditar
    // Orden 0..n-1 sin empates, con los dos paquetes intercambiados.
    const orden = filas.map((f) => f.id);
    [orden[i], orden[j]] = [orden[j], orden[i]];
    for (const [pos, pid] of orden.entries()) {
      if (filas.find((f) => f.id === pid)!.sortOrder !== pos) {
        await tx.update(novaPackages).set({ sortOrder: pos }).where(eq(novaPackages.id, pid));
      }
    }
    return null;
  });
  if (resultado === "extremo") return;
  if (resultado) return resultado;
  await audit({ action: "paqueteNova.movido", userId: yo.id, entity: "paqueteNova", entityId: id, meta: { direccion } });
  refresh();
}

/* ── Tipos de evento ────────────────────────────────────────── */

export type EstadoTipo = { error?: string; ok?: string; valor?: string } | undefined;

const nombreTipo = z.string().trim().min(2, { error: "Escribe un nombre (mínimo 2 letras)" }).max(40, { error: "Máximo 40 caracteres" });

async function tipoRepetido(nombre: string, exceptoId?: string) {
  const [t] = await db
    .select({ id: eventTypes.id })
    .from(eventTypes)
    .where(and(sql`lower(${eventTypes.name}) = ${nombre.toLowerCase()}`, exceptoId ? ne(eventTypes.id, exceptoId) : undefined))
    .limit(1);
  return Boolean(t);
}

export async function crearTipoEvento(_prev: EstadoTipo, formData: FormData): Promise<EstadoTipo> {
  const yo = await requireEquipo("cotizaciones.editar");
  const valor = String(formData.get("nombre") ?? "");
  const d = nombreTipo.safeParse(valor);
  if (!d.success) return { error: d.error.issues[0]?.message, valor };
  if (await tipoRepetido(d.data)) return { error: "Ya existe ese tipo de evento", valor };

  const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${eventTypes.sortOrder}), 0)` }).from(eventTypes);
  const [nuevo] = await db.insert(eventTypes).values({ name: d.data, sortOrder: Number(max) + 1 }).returning({ id: eventTypes.id });
  await audit({ action: "tipoEvento.creado", userId: yo.id, entity: "tipoEvento", entityId: nuevo.id, meta: { nombre: d.data } });
  refresh();
  return { ok: `Tipo «${d.data}» agregado.` };
}

export async function renombrarTipoEvento(id: string, _prev: EstadoTipo, formData: FormData): Promise<EstadoTipo> {
  const yo = await requireEquipo("cotizaciones.editar");
  const valor = String(formData.get("nombre") ?? "");
  if (!esUuid(id)) return { error: "Este tipo de evento ya no existe.", valor };
  const d = nombreTipo.safeParse(valor);
  if (!d.success) return { error: d.error.issues[0]?.message, valor };
  if (await tipoRepetido(d.data, id)) return { error: "Ya existe ese tipo de evento", valor };

  const r = await db.update(eventTypes).set({ name: d.data }).where(eq(eventTypes.id, id)).returning({ id: eventTypes.id });
  if (!r.length) return { error: "Este tipo de evento ya no existe.", valor };
  await audit({ action: "tipoEvento.renombrado", userId: yo.id, entity: "tipoEvento", entityId: id, meta: { nombre: d.data } });
  refresh();
  return { ok: "Guardado.", valor: d.data };
}

export async function eliminarTipoEvento(id: string): Promise<string | void> {
  const yo = await requireEquipo("cotizaciones.editar");
  if (!esUuid(id)) return "Este tipo de evento ya no existe.";
  const [{ total }] = await db.select({ total: count() }).from(quotes).where(eq(quotes.eventTypeId, id));
  if (total > 0) return `Hay ${total} ${total === 1 ? "cotización" : "cotizaciones"} con este tipo de evento. Cámbialas de tipo antes de eliminarlo.`;

  const [borrado] = await db.delete(eventTypes).where(eq(eventTypes.id, id)).returning({ name: eventTypes.name });
  if (!borrado) return "Este tipo de evento ya no existe.";
  await audit({ action: "tipoEvento.eliminado", userId: yo.id, entity: "tipoEvento", entityId: id, meta: { nombre: borrado.name } });
  refresh();
}
