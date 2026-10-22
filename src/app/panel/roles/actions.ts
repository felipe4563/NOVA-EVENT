"use server";

import { count, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { rolePermissions, roles, users } from "@/db/schema";
import { audit, requirePermission } from "@/lib/auth";
import { isPermission, type Permission } from "@/lib/permissions";

export type EstadoRol =
  | {
      errores?: Partial<Record<"nombre" | "descripcion" | "tipo", string>>;
      error?: string;
      ok?: string;
      valores?: { nombre?: string; descripcion?: string; tipo?: string; permisos?: string[] };
    }
  | undefined;

const esquema = z.object({
  nombre: z.string().trim().min(2, { error: "Escribe un nombre" }).max(60, { error: "Máximo 60 caracteres" }),
  descripcion: z.string().trim().max(200, { error: "Máximo 200 caracteres" }),
  tipo: z.enum(["staff", "provider", "client"], { error: "Elige el tipo de cuenta" }),
});

function leer(f: FormData) {
  return {
    nombre: String(f.get("nombre") ?? ""),
    descripcion: String(f.get("descripcion") ?? ""),
    tipo: String(f.get("tipo") ?? ""),
    permisos: f.getAll("permisos").map(String),
  };
}

/** Solo permisos válidos; crear, editar y eliminar incluyen siempre "ver". */
function normalizarPermisos(lista: string[]): Permission[] {
  const s = new Set(lista.filter(isPermission));
  for (const p of [...s]) s.add(`${p.slice(0, p.lastIndexOf("."))}.ver` as Permission);
  return [...s];
}

function erroresDe(e: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

/** "Coordinador de bodas" → "coordinador-de-bodas" (único). */
async function claveUnica(nombre: string) {
  const base =
    nombre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "rol";
  const existentes = new Set((await db.select({ key: roles.key }).from(roles)).map((r) => r.key));
  let clave = base;
  for (let n = 2; existentes.has(clave); n++) clave = `${base}-${n}`;
  return clave;
}

async function nombreEnUso(nombre: string, exceptoId?: string) {
  const lista = await db.select({ id: roles.id, name: roles.name }).from(roles);
  return lista.some((r) => r.id !== exceptoId && r.name.trim().toLowerCase() === nombre.toLowerCase());
}

export async function crearRol(_prev: EstadoRol, formData: FormData): Promise<EstadoRol> {
  const yo = await requirePermission("roles.crear");
  const valores = leer(formData);
  const datos = esquema.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };
  const d = datos.data;
  if (await nombreEnUso(d.nombre)) return { errores: { nombre: "Ya hay un rol con este nombre" }, valores };

  const permisos = normalizarPermisos(valores.permisos);
  const nuevoId = await db.transaction(async (tx) => {
    const [nuevo] = await tx
      .insert(roles)
      .values({ key: await claveUnica(d.nombre), name: d.nombre, description: d.descripcion || null, kind: d.tipo })
      .returning({ id: roles.id });
    if (permisos.length) await tx.insert(rolePermissions).values(permisos.map((permission) => ({ roleId: nuevo.id, permission })));
    return nuevo.id;
  });

  await audit({ action: "rol.creado", userId: yo.id, entity: "rol", entityId: nuevoId, meta: { nombre: d.nombre, permisos } });
  redirect("/panel/roles?ok=creado");
}

export async function actualizarRol(id: string, _prev: EstadoRol, formData: FormData): Promise<EstadoRol> {
  const yo = await requirePermission("roles.editar");
  const valores = leer(formData);

  const [rol] = await db.select().from(roles).where(eq(roles.id, id));
  if (!rol) return { error: "Este rol ya no existe.", valores };

  // Los roles base mantienen su tipo de cuenta.
  const datos = esquema.safeParse({ ...valores, tipo: rol.isSystem ? rol.kind : valores.tipo });
  if (!datos.success) return { errores: erroresDe(datos.error), valores };
  const d = datos.data;
  if (await nombreEnUso(d.nombre, id)) return { errores: { nombre: "Ya hay un rol con este nombre" }, valores };

  const permisos = normalizarPermisos(valores.permisos);
  await db.transaction(async (tx) => {
    await tx.update(roles).set({ name: d.nombre, description: d.descripcion || null, kind: d.tipo }).where(eq(roles.id, id));
    // El administrador tiene acceso total: su lista de permisos no se usa.
    if (!rol.fullAccess) {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
      if (permisos.length) await tx.insert(rolePermissions).values(permisos.map((permission) => ({ roleId: id, permission })));
    }
  });

  await audit({ action: "rol.editado", userId: yo.id, entity: "rol", entityId: id, meta: { nombre: d.nombre, permisos: rol.fullAccess ? "total" : permisos } });
  refresh(); // vuelve a dibujar la página con los datos nuevos (resumen, insignias)
  return { ok: "Cambios guardados. Se aplican de inmediato a todos los usuarios con este rol.", valores: { ...valores, permisos } };
}

export async function eliminarRol(id: string): Promise<string | void> {
  const yo = await requirePermission("roles.eliminar");
  const [rol] = await db.select().from(roles).where(eq(roles.id, id));
  if (!rol) return "Este rol ya no existe.";
  if (rol.isSystem) return "Los roles base del sistema no se pueden eliminar.";

  const [{ total }] = await db.select({ total: count() }).from(users).where(eq(users.roleId, id));
  if (total > 0) return `Hay ${total} ${total === 1 ? "usuario" : "usuarios"} con este rol. Cámbiales el rol antes de eliminarlo.`;

  await db.delete(roles).where(eq(roles.id, id));
  await audit({ action: "rol.eliminado", userId: yo.id, entity: "rol", entityId: id, meta: { nombre: rol.name } });
  redirect("/panel/roles?ok=eliminado");
}
