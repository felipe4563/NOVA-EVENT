import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { IconoAccion } from "@/components/iconos";
import { Aviso, Encabezado, Insignia, clases, formatoFecha } from "@/components/ui";

export const metadata: Metadata = { title: "Usuarios" };
export const instant = false;

const MENSAJES: Record<string, string> = {
  creado: "Usuario creado. Ya puede entrar con su correo y la contraseña que le asignaste.",
  eliminado: "Usuario eliminado.",
};

export default async function UsuariosPage({ searchParams }: PageProps<"/panel/usuarios">) {
  const yo = await requirePermission("usuarios.ver");
  const puedeCrear = hasPermission(yo, "usuarios.crear");
  const puedeEditar = hasPermission(yo, "usuarios.editar");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const rolFiltro = typeof sp.rol === "string" ? sp.rol : "";
  const estado = sp.estado === "activos" || sp.estado === "inactivos" ? sp.estado : "";
  const ok = typeof sp.ok === "string" ? MENSAJES[sp.ok] : undefined;

  const todosLosRoles = await db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(asc(roles.name));

  const filtros: SQL[] = [];
  if (q) {
    const patron = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    filtros.push(or(ilike(users.name, patron), ilike(users.email, patron))!);
  }
  if (todosLosRoles.some((r) => r.id === rolFiltro)) filtros.push(eq(users.roleId, rolFiltro));
  if (estado) filtros.push(eq(users.active, estado === "activos"));

  const lista = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      active: users.active,
      lastLoginAt: users.lastLoginAt,
      roleName: roles.name,
      fullAccess: roles.fullAccess,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(filtros.length ? and(...filtros) : undefined)
    .orderBy(asc(users.name));

  const hayFiltros = Boolean(q || rolFiltro || estado);

  return (
    <div className="w-full">
      <Encabezado seccion="Administración" titulo="Usuarios" descripcion="Personas que pueden entrar al sistema y qué rol tienen.">
        {puedeCrear && (
          <Link href="/panel/usuarios/nuevo" className={clases.botonPrimario}>
            <IconoAccion accion="mas" /> Nuevo usuario
          </Link>
        )}
      </Encabezado>

      {ok && <Aviso>{ok}</Aviso>}

      {/* Filtros: un formulario GET, así los filtros quedan en la URL */}
      <form className={`${clases.tarjeta} mb-5 grid gap-3 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center`}>
        <label className="relative block">
          <span className="sr-only">Buscar</span>
          <IconoAccion accion="buscar" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave" />
          <input name="q" defaultValue={q} placeholder="Buscar por nombre o correo" className={`${clases.campo} pl-9`} />
        </label>
        <label className="block">
          <span className="sr-only">Rol</span>
          <select name="rol" defaultValue={rolFiltro} className={clases.campo}>
            <option value="">Todos los roles</option>
            {todosLosRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Estado</span>
          <select name="estado" defaultValue={estado} className={clases.campo}>
            <option value="">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className={`${clases.botonSecundario} flex-1`}>
            Filtrar
          </button>
          {hayFiltros && (
            <Link href="/panel/usuarios" className={`${clases.botonSecundario} flex-1`}>
              Limpiar
            </Link>
          )}
        </div>
      </form>

      <p className="mb-3 text-sm text-texto-suave">
        {lista.length} {lista.length === 1 ? "usuario" : "usuarios"}
        {hayFiltros && " con estos filtros"}
      </p>

      {lista.length === 0 ? (
        <div className={`${clases.tarjeta} p-10 text-center`}>
          <p className="font-semibold text-texto">No hay usuarios{hayFiltros ? " con estos filtros" : ""}</p>
          <p className="mt-1 text-sm text-texto-suave">{hayFiltros ? "Prueba con otra búsqueda." : "Crea el primero con «Nuevo usuario»."}</p>
        </div>
      ) : (
        <>
          {/* Computadora: tabla */}
          <div className={`${clases.tarjeta} hidden overflow-hidden md:block`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-borde bg-superficie-2 text-xs tracking-wide text-texto-suave uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Usuario</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Rol</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Estado</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Último acceso</th>
                  <th scope="col" className="px-5 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {lista.map((u) => (
                  <tr key={u.id} className="transition hover:bg-superficie-2/60">
                    <td className="px-5 py-3.5">
                      <Persona nombre={u.name} email={u.email} esYo={u.id === yo.id} />
                    </td>
                    <td className="px-5 py-3.5">
                      <Insignia tono={u.fullAccess ? "vino" : "neutro"}>{u.roleName}</Insignia>
                    </td>
                    <td className="px-5 py-3.5">
                      <Estado activo={u.active} />
                    </td>
                    <td className="px-5 py-3.5 text-texto-suave">{formatoFecha(u.lastLoginAt)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/panel/usuarios/${u.id}`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-enlace hover:bg-activo hover:text-titulo">
                        {puedeEditar ? <><IconoAccion accion="editar" /> Editar</> : "Ver"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular y tablet: tarjetas */}
          <ul className="grid gap-3 sm:grid-cols-2 md:hidden">
            {lista.map((u) => (
              <li key={u.id}>
                <Link href={`/panel/usuarios/${u.id}`} className={`${clases.tarjeta} block p-4 transition hover:border-borde-campo`}>
                  <Persona nombre={u.name} email={u.email} esYo={u.id === yo.id} />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Insignia tono={u.fullAccess ? "vino" : "neutro"}>{u.roleName}</Insignia>
                    <Estado activo={u.active} />
                  </div>
                  <p className="mt-3 text-xs text-texto-suave">Último acceso: {formatoFecha(u.lastLoginAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Persona({ nombre, email, esYo }: { nombre: string; email: string; esYo: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-activo text-sm font-semibold text-titulo" aria-hidden>
        {nombre.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate font-semibold text-texto">
          <span className="truncate">{nombre}</span>
          {esYo && <Insignia tono="oro">Tú</Insignia>}
        </p>
        <p className="truncate text-sm text-texto-suave">{email}</p>
      </div>
    </div>
  );
}

function Estado({ activo }: { activo: boolean }) {
  return activo ? <Insignia tono="agua">● Activo</Insignia> : <Insignia tono="error">● Inactivo</Insignia>;
}
