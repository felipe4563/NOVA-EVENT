import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { roles, suppliers, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { TIPOS_CUENTA, hasPermission } from "@/lib/permissions";
import { BotonConfirmar } from "@/components/boton-confirmar";
import { IconoAccion } from "@/components/iconos";
import {
  Aviso,
  Encabezado,
  Insignia,
  clases,
  formatoFecha,
} from "@/components/ui";
import {
  actualizarUsuario,
  cambiarContrasena,
  cambiarEstado,
  eliminarUsuario,
} from "../actions";
import { FormularioContrasena, FormularioUsuario } from "../formulario-usuario";
import { proveedoresParaFormulario, rolesParaFormulario } from "../roles-para-formulario";

export const metadata: Metadata = { title: "Usuario" };
export const instant = false;

const MENSAJES: Record<string, string> = {
  activado: "Cuenta activada. Ya puede iniciar sesión.",
  desactivado:
    "Cuenta desactivada. Se cerraron sus sesiones y ya no puede entrar.",
};

export default async function UsuarioPage({
  params,
  searchParams,
}: PageProps<"/panel/usuarios/[id]">) {
  const yo = await requirePermission("usuarios.ver");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? MENSAJES[sp.ok] : undefined;

  const [u] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      active: users.active,
      roleId: users.roleId,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      roleName: roles.name,
      roleKind: roles.kind,
      fullAccess: roles.fullAccess,
      supplierId: users.supplierId,
      supplierName: suppliers.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(suppliers, eq(users.supplierId, suppliers.id))
    .where(eq(users.id, id));
  if (!u) notFound();

  const puedeEditar = hasPermission(yo, "usuarios.editar");
  const puedeEliminar = hasPermission(yo, "usuarios.eliminar");
  const esYo = u.id === yo.id;

  return (
    <div className="w-full">
      <Encabezado
        seccion="Usuarios"
        titulo={u.name}
        volver={{ href: "/panel/usuarios", texto: "Usuarios" }}
      />

      {ok && <Aviso>{ok}</Aviso>}

      {/* Resumen */}
      <section
        className={`${clases.tarjeta} mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6`}
      >
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-activo text-xl font-semibold text-titulo"
          aria-hidden
        >
          {u.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-texto-suave">{u.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Insignia tono={u.fullAccess ? "vino" : "neutro"}>
              {u.roleName}
            </Insignia>
            {u.roleName !== TIPOS_CUENTA[u.roleKind] && (
              <Insignia>{TIPOS_CUENTA[u.roleKind]}</Insignia>
            )}
            {u.active ? (
              <Insignia tono="agua">● Activo</Insignia>
            ) : (
              <Insignia tono="error">● Inactivo</Insignia>
            )}
            {esYo && <Insignia tono="oro">Tú</Insignia>}
          </div>
          {u.roleKind === "provider" && (
            <p className="mt-2 text-sm text-texto-suave">
              {u.supplierId ? (
                <>
                  Proveedor:{" "}
                  {hasPermission(yo, "proveedores.ver") && yo.role.kind === "staff" ? (
                    <Link href={`/panel/proveedores/${u.supplierId}`} className="font-medium text-enlace hover:text-titulo">
                      {u.supplierName}
                    </Link>
                  ) : (
                    <span className="font-medium text-texto">{u.supplierName}</span>
                  )}
                </>
              ) : (
                <span className="text-error">Sin proveedor vinculado: no puede registrar días ocupados.</span>
              )}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:text-right">
          <dt className="text-texto-suave">Último acceso</dt>
          <dd className="text-texto">{formatoFecha(u.lastLoginAt)}</dd>
          <dt className="text-texto-suave">Creado</dt>
          <dd className="text-texto">{formatoFecha(u.createdAt, false)}</dd>
        </dl>
      </section>

      {puedeEditar && (
        <div className="mb-5 grid items-start gap-5 xl:grid-cols-[3fr_2fr]">
          <section className={`${clases.tarjeta} p-5 sm:p-7`}>
            <h2 className="mb-5 font-semibold text-texto">
              Datos de la cuenta
            </h2>
            <FormularioUsuario
              accion={actualizarUsuario.bind(null, u.id)}
              roles={await rolesParaFormulario()}
              proveedores={await proveedoresParaFormulario()}
              inicial={{ nombre: u.name, email: u.email, rol: u.roleId, proveedor: u.supplierId ?? "" }}
              esNuevo={false}
              rolBloqueado={
                esYo
                  ? "No puedes cambiar tu propio rol. Pídeselo a otro administrador."
                  : undefined
              }
            />
          </section>

          <section className={`${clases.tarjeta} p-5 sm:p-7`}>
            <h2 className="flex items-center gap-2 font-semibold text-texto">
              <IconoAccion accion="llave" className="size-5 text-acento" />{" "}
              Restablecer contraseña
            </h2>
            <p className="mt-1 mb-5 text-sm text-texto-suave">
              {esYo
                ? "Al cambiarla tendrás que volver a iniciar sesión."
                : "Se cerrarán sus sesiones abiertas y tendrá que entrar con la nueva contraseña."}
            </p>
            <FormularioContrasena accion={cambiarContrasena.bind(null, u.id)} />
          </section>
        </div>
      )}

      {!esYo && (puedeEditar || puedeEliminar) && (
        <section className="rounded-2xl border border-error/30 p-5 sm:p-7">
          <h2 className="font-semibold text-error">Zona delicada</h2>
          <div className="mt-4 divide-y divide-borde">
            {puedeEditar && (
              <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-texto">
                    {u.active ? "Desactivar cuenta" : "Activar cuenta"}
                  </p>
                  <p className="text-sm text-texto-suave">
                    {u.active
                      ? "No podrá entrar, pero se conservan sus datos. Puedes activarla cuando quieras."
                      : "Podrá volver a iniciar sesión."}
                  </p>
                </div>
                <BotonConfirmar
                  accion={cambiarEstado.bind(null, u.id, !u.active)}
                  titulo={
                    u.active
                      ? `¿Desactivar a ${u.name}?`
                      : `¿Activar a ${u.name}?`
                  }
                  mensaje={
                    u.active
                      ? "Se cerrarán sus sesiones y no podrá entrar hasta que la actives de nuevo."
                      : "Podrá iniciar sesión con su contraseña actual."
                  }
                  textoConfirmar={u.active ? "Desactivar" : "Activar"}
                  peligro={u.active}
                  className={`${u.active ? clases.botonPeligro : clases.botonSecundario} shrink-0`}
                >
                  <IconoAccion accion={u.active ? "pausa" : "play"} />{" "}
                  {u.active ? "Desactivar" : "Activar"}
                </BotonConfirmar>
              </div>
            )}
            {puedeEliminar && (
              <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-texto">
                    Eliminar usuario
                  </p>
                  <p className="text-sm text-texto-suave">
                    Se borra la cuenta para siempre. Si solo quieres quitarle el
                    acceso, mejor desactívala.
                  </p>
                </div>
                <BotonConfirmar
                  accion={eliminarUsuario.bind(null, u.id)}
                  titulo={`¿Eliminar a ${u.name}?`}
                  mensaje="Esta acción no se puede deshacer. El registro de actividad se conserva."
                  textoConfirmar="Eliminar para siempre"
                  peligro
                  className={`${clases.botonPeligro} shrink-0`}
                >
                  <IconoAccion accion="basura" /> Eliminar
                </BotonConfirmar>
              </div>
            )}
          </div>
        </section>
      )}

      {!puedeEditar && !puedeEliminar && (
        <p className="text-sm text-texto-suave">
          Solo puedes ver este usuario. Para cambiarlo necesitas el permiso
          «Usuarios: editar».
        </p>
      )}
    </div>
  );
}
