import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { rolePermissions, roles, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { ACTIONS, MODULES, TIPOS_CUENTA, accionesDe, hasPermission } from "@/lib/permissions";
import { BotonConfirmar } from "@/components/boton-confirmar";
import { IconoAccion } from "@/components/iconos";
import { Encabezado, Insignia, clases } from "@/components/ui";
import { actualizarRol, eliminarRol } from "../actions";
import { modulosMatriz, tiposCuenta } from "../datos";
import { FormularioRol } from "../formulario-rol";

export const metadata: Metadata = { title: "Rol" };
export const instant = false;

export default async function RolPage({ params }: PageProps<"/panel/roles/[id]">) {
  const yo = await requirePermission("roles.ver");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [rol] = await db.select().from(roles).where(eq(roles.id, id));
  if (!rol) notFound();

  const [permisos, miembros] = await Promise.all([
    db.select({ p: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.roleId, id)),
    db.select({ id: users.id, name: users.name, active: users.active }).from(users).where(eq(users.roleId, id)).orderBy(asc(users.name)),
  ]);
  const lista = permisos.map((x) => x.p);
  const puedeEditar = hasPermission(yo, "roles.editar");
  const puedeEliminar = hasPermission(yo, "roles.eliminar");

  return (
    <div className="w-full">
      <Encabezado seccion="Roles y permisos" titulo={rol.name} volver={{ href: "/panel/roles", texto: "Roles y permisos" }}>
        <div className="flex flex-wrap gap-1.5">
          <Insignia>{TIPOS_CUENTA[rol.kind]}</Insignia>
          {rol.fullAccess && <Insignia tono="vino">Acceso total</Insignia>}
          {rol.isSystem && <Insignia>Rol base</Insignia>}
        </div>
      </Encabezado>

      {puedeEditar ? (
        <FormularioRol
          accion={actualizarRol.bind(null, rol.id)}
          modulos={modulosMatriz}
          tipos={tiposCuenta}
          inicial={{ nombre: rol.name, descripcion: rol.description ?? "", tipo: rol.kind, permisos: lista }}
          esNuevo={false}
          accesoTotal={rol.fullAccess}
          tipoBloqueado={rol.isSystem}
        />
      ) : (
        <section className={`${clases.tarjeta} p-5 sm:p-7`}>
          {rol.description && <p className="mb-4 text-sm text-texto-suave">{rol.description}</p>}
          <h2 className="mb-3 font-semibold text-texto">Permisos</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {MODULES.map((m) => {
              const tiene = accionesDe(m.key).filter((a) => rol.fullAccess || lista.includes(`${m.key}.${a}`));
              return (
                <li key={m.key} className="flex items-center justify-between gap-3 rounded-lg bg-superficie-2 px-3 py-2 text-sm">
                  <span className={tiene.length ? "text-texto" : "text-texto-suave line-through"}>{m.label}</span>
                  <span className="text-right text-xs text-texto-suave">{tiene.length ? tiene.map((a) => ACTIONS[a]).join(", ") : "Sin acceso"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Quiénes tienen este rol */}
      <section className={`${clases.tarjeta} mt-6 p-5 sm:p-7`}>
        <h2 className="font-semibold text-texto">
          Usuarios con este rol <span className="font-normal text-texto-suave">({miembros.length})</span>
        </h2>
        {miembros.length === 0 ? (
          <p className="mt-2 text-sm text-texto-suave">Nadie tiene este rol todavía.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {miembros.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/panel/usuarios/${m.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-borde bg-superficie-2 py-1 pr-3 pl-1 text-sm text-texto hover:border-borde-campo"
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-activo text-xs font-semibold text-titulo">{m.name.charAt(0).toUpperCase()}</span>
                  {m.name}
                  {!m.active && <span className="text-xs text-error">(inactivo)</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {puedeEliminar && !rol.isSystem && (
        <section className="mt-6 flex flex-col gap-3 rounded-2xl border border-error/30 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <p className="font-semibold text-error">Eliminar rol</p>
            <p className="text-sm text-texto-suave">
              {miembros.length > 0 ? "Primero cambia de rol a los usuarios que lo tienen." : "Se borra para siempre."}
            </p>
          </div>
          <BotonConfirmar
            accion={eliminarRol.bind(null, rol.id)}
            titulo={`¿Eliminar el rol «${rol.name}»?`}
            mensaje="Esta acción no se puede deshacer."
            textoConfirmar="Eliminar rol"
            peligro
            className={`${clases.botonPeligro} shrink-0`}
          >
            <IconoAccion accion="basura" /> Eliminar
          </BotonConfirmar>
        </section>
      )}
    </div>
  );
}
