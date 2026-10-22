"use server";

import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { supplierCategories, suppliers } from "@/db/schema";
import { borrarCarpetaProveedor } from "@/lib/archivos";
import { audit, requireEquipo } from "@/lib/auth";

export type EstadoProveedor =
  | {
      errores?: Partial<Record<Campo, string>>;
      error?: string;
      ok?: string;
      valores?: Partial<Record<Campo, string>> & { activo?: boolean };
    }
  | undefined;

type Campo = "nombre" | "categoria" | "contacto" | "telefono" | "email" | "direccion" | "web" | "servicios" | "notas" | "capacidad";

const opcional = (max: number) => z.string().trim().max(max, { error: `Máximo ${max} caracteres` });

const esquema = z.object({
  nombre: z.string().trim().min(2, { error: "Escribe el nombre del negocio" }).max(120, { error: "Máximo 120 caracteres" }),
  categoria: z.uuid({ error: "Elige una categoría" }),
  contacto: opcional(120),
  telefono: opcional(40),
  email: z.union([z.literal(""), z.email({ error: "Escribe un correo válido" }).trim().toLowerCase().max(160)]),
  direccion: opcional(200),
  web: opcional(200),
  capacidad: z
    .string()
    .trim()
    .refine((t) => t === "" || (/^\d{1,6}$/.test(t) && Number(t) >= 1), { error: "Escribe un número entero de 1 en adelante, o déjalo vacío" }),
  servicios: opcional(2000),
  notas: opcional(2000),
  activo: z.boolean(),
});

const CAMPOS: Campo[] = ["nombre", "categoria", "contacto", "telefono", "email", "direccion", "web", "servicios", "notas", "capacidad"];

function leer(f: FormData) {
  const v: Partial<Record<Campo, string>> & { activo: boolean } = { activo: f.get("activo") === "on" };
  for (const c of CAMPOS) v[c] = String(f.get(c) ?? "").trim();
  return v;
}

function erroresDe(e: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

/** Los campos vacíos se guardan como null. */
function aFila(d: z.infer<typeof esquema>) {
  const n = (s: string) => s || null;
  return {
    name: d.nombre,
    categoryId: d.categoria,
    contactName: n(d.contacto),
    phone: n(d.telefono),
    email: n(d.email),
    address: n(d.direccion),
    website: n(d.web),
    services: n(d.servicios),
    capacity: d.capacidad ? Number(d.capacidad) : null,
    notes: n(d.notas),
    active: d.activo,
  };
}

async function categoriaExiste(id: string) {
  const [c] = await db.select({ id: supplierCategories.id }).from(supplierCategories).where(eq(supplierCategories.id, id));
  return Boolean(c);
}

async function nombreEnUso(nombre: string, exceptoId?: string) {
  const [p] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(and(sql`lower(${suppliers.name}) = ${nombre.toLowerCase()}`, exceptoId ? ne(suppliers.id, exceptoId) : undefined))
    .limit(1);
  return Boolean(p);
}

export async function crearProveedor(_prev: EstadoProveedor, formData: FormData): Promise<EstadoProveedor> {
  const yo = await requireEquipo("proveedores.crear");
  const valores = leer(formData);
  const datos = esquema.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };
  if (!(await categoriaExiste(datos.data.categoria))) return { errores: { categoria: "Esa categoría ya no existe" }, valores };
  if (await nombreEnUso(datos.data.nombre)) return { errores: { nombre: "Ya hay un proveedor con este nombre" }, valores };

  const [nuevo] = await db.insert(suppliers).values(aFila(datos.data)).returning({ id: suppliers.id });
  await audit({ action: "proveedor.creado", userId: yo.id, entity: "proveedor", entityId: nuevo.id, meta: { nombre: datos.data.nombre } });
  redirect(`/panel/proveedores/${nuevo.id}?ok=creado`);
}

export async function actualizarProveedor(id: string, _prev: EstadoProveedor, formData: FormData): Promise<EstadoProveedor> {
  const yo = await requireEquipo("proveedores.editar");
  const valores = leer(formData);
  const datos = esquema.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };
  if (!(await categoriaExiste(datos.data.categoria))) return { errores: { categoria: "Esa categoría ya no existe" }, valores };
  if (await nombreEnUso(datos.data.nombre, id)) return { errores: { nombre: "Ya hay un proveedor con este nombre" }, valores };

  const r = await db.update(suppliers).set(aFila(datos.data)).where(eq(suppliers.id, id)).returning({ id: suppliers.id });
  if (!r.length) return { error: "Este proveedor ya no existe.", valores };
  await audit({ action: "proveedor.editado", userId: yo.id, entity: "proveedor", entityId: id });
  refresh();
  return { ok: "Cambios guardados.", valores };
}

export async function eliminarProveedor(id: string): Promise<string | void> {
  const yo = await requireEquipo("proveedores.eliminar");
  const [borrado] = await db.delete(suppliers).where(eq(suppliers.id, id)).returning({ name: suppliers.name });
  if (!borrado) return "Este proveedor ya no existe.";
  await borrarCarpetaProveedor(id); // fotos, planos y audios de su galería
  await audit({ action: "proveedor.eliminado", userId: yo.id, entity: "proveedor", entityId: id, meta: { nombre: borrado.name } });
  redirect("/panel/proveedores?ok=eliminado");
}

/* ── Categorías ─────────────────────────────────────────────── */

export type EstadoCategoria = { error?: string; ok?: string; valor?: string } | undefined;

const nombreCategoria = z.string().trim().min(2, { error: "Escribe un nombre (mínimo 2 letras)" }).max(60, { error: "Máximo 60 caracteres" });

async function categoriaRepetida(nombre: string, exceptoId?: string) {
  const [c] = await db
    .select({ id: supplierCategories.id })
    .from(supplierCategories)
    .where(and(sql`lower(${supplierCategories.name}) = ${nombre.toLowerCase()}`, exceptoId ? ne(supplierCategories.id, exceptoId) : undefined))
    .limit(1);
  return Boolean(c);
}

export async function crearCategoria(_prev: EstadoCategoria, formData: FormData): Promise<EstadoCategoria> {
  const yo = await requireEquipo("proveedores.editar");
  const valor = String(formData.get("nombre") ?? "");
  const d = nombreCategoria.safeParse(valor);
  if (!d.success) return { error: d.error.issues[0]?.message, valor };
  if (await categoriaRepetida(d.data)) return { error: "Ya existe esa categoría", valor };

  const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${supplierCategories.sortOrder}), 0)` }).from(supplierCategories);
  const [nueva] = await db.insert(supplierCategories).values({ name: d.data, sortOrder: Number(max) + 1 }).returning({ id: supplierCategories.id });
  await audit({ action: "categoria.creada", userId: yo.id, entity: "categoria", entityId: nueva.id, meta: { nombre: d.data } });
  refresh();
  return { ok: `Categoría «${d.data}» agregada.` };
}

export async function renombrarCategoria(id: string, _prev: EstadoCategoria, formData: FormData): Promise<EstadoCategoria> {
  const yo = await requireEquipo("proveedores.editar");
  const valor = String(formData.get("nombre") ?? "");
  const d = nombreCategoria.safeParse(valor);
  if (!d.success) return { error: d.error.issues[0]?.message, valor };
  if (await categoriaRepetida(d.data, id)) return { error: "Ya existe esa categoría", valor };

  const r = await db.update(supplierCategories).set({ name: d.data }).where(eq(supplierCategories.id, id)).returning({ id: supplierCategories.id });
  if (!r.length) return { error: "Esta categoría ya no existe.", valor };
  await audit({ action: "categoria.editada", userId: yo.id, entity: "categoria", entityId: id, meta: { nombre: d.data } });
  refresh();
  return { ok: "Guardado.", valor: d.data };
}

export async function eliminarCategoria(id: string): Promise<string | void> {
  const yo = await requireEquipo("proveedores.editar");
  const [{ total }] = await db.select({ total: count() }).from(suppliers).where(eq(suppliers.categoryId, id));
  if (total > 0) return `Hay ${total} ${total === 1 ? "proveedor" : "proveedores"} en esta categoría. Cámbialos de categoría antes de eliminarla.`;

  const [borrada] = await db.delete(supplierCategories).where(eq(supplierCategories.id, id)).returning({ name: supplierCategories.name });
  if (!borrada) return "Esta categoría ya no existe.";
  await audit({ action: "categoria.eliminada", userId: yo.id, entity: "categoria", entityId: id, meta: { nombre: borrada.name } });
  refresh();
}

/** Sube o baja una categoría un lugar en el orden (intercambia con su vecina). */
export async function moverCategoria(id: string, direccion: "arriba" | "abajo"): Promise<string | void> {
  const yo = await requireEquipo("proveedores.editar");
  const resultado = await db.transaction(async (tx) => {
    const filas = await tx
      .select({ id: supplierCategories.id, sortOrder: supplierCategories.sortOrder })
      .from(supplierCategories)
      .orderBy(asc(supplierCategories.sortOrder), asc(supplierCategories.name))
      .for("update");
    const i = filas.findIndex((f) => f.id === id);
    if (i < 0) return "Esta categoría ya no existe.";
    const j = direccion === "arriba" ? i - 1 : i + 1;
    if (j < 0 || j >= filas.length) return null; // ya está en el extremo
    // Orden 0..n-1 sin empates, con las dos categorías intercambiadas.
    const orden = filas.map((f) => f.id);
    [orden[i], orden[j]] = [orden[j], orden[i]];
    for (const [pos, cid] of orden.entries()) {
      if (filas.find((f) => f.id === cid)!.sortOrder !== pos) {
        await tx.update(supplierCategories).set({ sortOrder: pos }).where(eq(supplierCategories.id, cid));
      }
    }
    return null;
  });
  if (resultado) return resultado;
  await audit({ action: "categoria.movida", userId: yo.id, entity: "categoria", entityId: id, meta: { direccion } });
  refresh();
}
