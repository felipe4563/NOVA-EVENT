"use server";

import bcrypt from "bcryptjs";
import { and, count, eq, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { roles, sessions, suppliers, users } from "@/db/schema";
import { audit, requirePermission } from "@/lib/auth";

export type EstadoForm =
  | {
      errores?: Partial<Record<"nombre" | "email" | "rol" | "password" | "proveedor", string>>;
      error?: string;
      ok?: string;
      /** Lo que se escribió, para no perderlo si hay errores (React limpia el formulario al enviar). */
      valores?: { nombre?: string; email?: string; rol?: string; proveedor?: string; activo?: boolean };
    }
  | undefined;

const nombre = z.string().trim().min(2, { error: "Escribe el nombre completo" }).max(120, { error: "Máximo 120 caracteres" });
const email = z.email({ error: "Escribe un correo válido" }).trim().toLowerCase().max(160);
const rol = z.uuid({ error: "Elige un rol" });
const password = z
  .string()
  .min(8, { error: "Mínimo 8 caracteres" })
  .max(72, { error: "Máximo 72 caracteres" })
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), { error: "Usa letras y números" });

function valoresDe(f: FormData) {
  const t = (k: string) => (typeof f.get(k) === "string" ? String(f.get(k)) : undefined);
  return { nombre: t("nombre"), email: t("email"), rol: t("rol"), proveedor: t("proveedor"), activo: f.get("activo") === "on" };
}

function erroresDe(e: z.ZodError): NonNullable<EstadoForm>["errores"] {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const k = String(i.path[0]);
    out[k] ??= i.message;
  }
  return out;
}

/** ¿Al quitar a este usuario como administrador activo, el sistema se queda sin ninguno? */
async function quedariaSinAdministrador(userId: string) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(roles.fullAccess, true), eq(users.active, true), ne(users.id, userId)));
  return total === 0;
}

async function esAdministradorActivo(userId: string) {
  const [u] = await db
    .select({ activo: users.active, total: roles.fullAccess })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId));
  return Boolean(u?.activo && u.total);
}

async function correoEnUso(correo: string, exceptoId?: string) {
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(exceptoId ? and(eq(users.email, correo), ne(users.id, exceptoId)) : eq(users.email, correo))
    .limit(1);
  return Boolean(u);
}

async function rolExiste(roleId: string) {
  const [r] = await db.select({ id: roles.id, fullAccess: roles.fullAccess, kind: roles.kind }).from(roles).where(eq(roles.id, roleId));
  return r;
}

/**
 * Las cuentas de proveedor deben pertenecer a un proveedor; las demás, a ninguno.
 * Devuelve el id a guardar, o un error para el campo "proveedor".
 */
async function proveedorDeLaCuenta(kind: "staff" | "provider" | "client", valor: FormDataEntryValue | null): Promise<{ supplierId: string | null; error?: string }> {
  if (kind !== "provider") return { supplierId: null };
  const id = typeof valor === "string" ? valor : "";
  if (!z.uuid().safeParse(id).success) return { supplierId: null, error: "Elige a qué proveedor pertenece esta cuenta" };
  const [p] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, id));
  return p ? { supplierId: p.id } : { supplierId: null, error: "Ese proveedor ya no existe" };
}

export async function crearUsuario(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const yo = await requirePermission("usuarios.crear");

  const datos = z
    .object({ nombre, email, rol, password, activo: z.boolean() })
    .safeParse({
      nombre: formData.get("nombre"),
      email: formData.get("email"),
      rol: formData.get("rol"),
      password: formData.get("password"),
      activo: formData.get("activo") === "on",
    });
  if (!datos.success) return { errores: erroresDe(datos.error), valores: valoresDe(formData) };
  const d = datos.data;

  const rolNuevo = await rolExiste(d.rol);
  if (!rolNuevo) return { errores: { rol: "Ese rol ya no existe" }, valores: valoresDe(formData) };
  const prov = await proveedorDeLaCuenta(rolNuevo.kind, formData.get("proveedor"));
  if (prov.error) return { errores: { proveedor: prov.error }, valores: valoresDe(formData) };
  if (await correoEnUso(d.email)) return { errores: { email: "Ya hay un usuario con este correo" }, valores: valoresDe(formData) };

  const [nuevo] = await db
    .insert(users)
    .values({
      name: d.nombre,
      email: d.email,
      roleId: d.rol,
      supplierId: prov.supplierId,
      active: d.activo,
      passwordHash: await bcrypt.hash(d.password, 12),
    })
    .returning({ id: users.id });

  await audit({ action: "usuario.creado", userId: yo.id, entity: "usuario", entityId: nuevo.id, meta: { email: d.email } });
  redirect("/panel/usuarios?ok=creado");
}

export async function actualizarUsuario(id: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const yo = await requirePermission("usuarios.editar");

  const datos = z
    .object({ nombre, email, rol })
    .safeParse({ nombre: formData.get("nombre"), email: formData.get("email"), rol: formData.get("rol") });
  if (!datos.success) return { errores: erroresDe(datos.error), valores: valoresDe(formData) };
  const d = datos.data;

  const [actual] = await db.select({ roleId: users.roleId }).from(users).where(eq(users.id, id));
  if (!actual) return { error: "Este usuario ya no existe.", valores: valoresDe(formData) };

  const rolNuevo = await rolExiste(d.rol);
  if (!rolNuevo) return { errores: { rol: "Ese rol ya no existe" }, valores: valoresDe(formData) };
  const prov = await proveedorDeLaCuenta(rolNuevo.kind, formData.get("proveedor"));
  if (prov.error) return { errores: { proveedor: prov.error }, valores: valoresDe(formData) };
  if (await correoEnUso(d.email, id)) return { errores: { email: "Ya hay un usuario con este correo" }, valores: valoresDe(formData) };

  if (actual.roleId !== d.rol) {
    if (id === yo.id) return { errores: { rol: "No puedes cambiar tu propio rol. Pídeselo a otro administrador." }, valores: valoresDe(formData) };
    if (!rolNuevo.fullAccess && (await esAdministradorActivo(id)) && (await quedariaSinAdministrador(id))) {
      return { errores: { rol: "Es el único administrador activo: el sistema se quedaría sin administradores." }, valores: valoresDe(formData) };
    }
  }

  await db.update(users).set({ name: d.nombre, email: d.email, roleId: d.rol, supplierId: prov.supplierId }).where(eq(users.id, id));
  await audit({
    action: "usuario.editado",
    userId: yo.id,
    entity: "usuario",
    entityId: id,
    meta: actual.roleId !== d.rol ? { rolAnterior: actual.roleId, rolNuevo: d.rol } : undefined,
  });
  refresh(); // vuelve a dibujar la página con los datos nuevos (resumen, insignias)
  return { ok: "Cambios guardados.", valores: valoresDe(formData) };
}

export async function cambiarContrasena(id: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const yo = await requirePermission("usuarios.editar");

  const datos = password.safeParse(formData.get("password"));
  if (!datos.success) return { errores: { password: datos.error.issues[0]?.message } };

  const r = await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(datos.data, 12) })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (!r.length) return { error: "Este usuario ya no existe." };

  // Cierra sus sesiones abiertas para que entre con la contraseña nueva (si es uno mismo, se mantiene la actual).
  await db.delete(sessions).where(eq(sessions.userId, id));
  await audit({ action: "usuario.contrasena", userId: yo.id, entity: "usuario", entityId: id });
  if (id === yo.id) redirect("/login");
  return { ok: "Contraseña actualizada. Se cerraron sus sesiones abiertas." };
}

export async function cambiarEstado(id: string, activo: boolean): Promise<string | void> {
  const yo = await requirePermission("usuarios.editar");
  if (id === yo.id && !activo) return "No puedes desactivar tu propia cuenta.";
  if (!activo && (await esAdministradorActivo(id)) && (await quedariaSinAdministrador(id))) {
    return "Es el único administrador activo: el sistema se quedaría sin administradores.";
  }

  const r = await db.update(users).set({ active: activo }).where(eq(users.id, id)).returning({ id: users.id });
  if (!r.length) return "Este usuario ya no existe.";
  if (!activo) await db.delete(sessions).where(eq(sessions.userId, id));
  await audit({ action: activo ? "usuario.activado" : "usuario.desactivado", userId: yo.id, entity: "usuario", entityId: id });
  redirect(`/panel/usuarios/${id}?ok=${activo ? "activado" : "desactivado"}`);
}

export async function eliminarUsuario(id: string): Promise<string | void> {
  const yo = await requirePermission("usuarios.eliminar");
  if (id === yo.id) return "No puedes eliminar tu propia cuenta.";
  if ((await esAdministradorActivo(id)) && (await quedariaSinAdministrador(id))) {
    return "Es el único administrador activo: el sistema se quedaría sin administradores.";
  }

  const [borrado] = await db.delete(users).where(eq(users.id, id)).returning({ email: users.email });
  if (!borrado) return "Este usuario ya no existe.";
  await audit({ action: "usuario.eliminado", userId: yo.id, entity: "usuario", entityId: id, meta: { email: borrado.email } });
  redirect("/panel/usuarios?ok=eliminado");
}
