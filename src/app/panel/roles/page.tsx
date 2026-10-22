import type { Metadata } from "next";
import Link from "next/link";
import { asc, count } from "drizzle-orm";
import { db } from "@/db";
import { rolePermissions, roles, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { MODULES, TIPOS_CUENTA, hasPermission } from "@/lib/permissions";
import { IconoAccion, IconoModulo } from "@/components/iconos";
import { Aviso, Encabezado, Insignia, clases } from "@/components/ui";

export const metadata: Metadata = { title: "Roles y permisos" };
export const instant = false;

const MENSAJES: Record<string, string> = {
  creado: "Rol creado. Ya puedes asignarlo a usuarios.",
  eliminado: "Rol eliminado.",
};

const TONO_TIPO = { staff: "vino", provider: "agua", client: "oro" } as const;

export default async function RolesPage({ searchParams }: PageProps<"/panel/roles">) {
  const yo = await requirePermission("roles.ver");
  const puedeCrear = hasPermission(yo, "roles.crear");
  const puedeEditar = hasPermission(yo, "roles.editar");
  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? MENSAJES[sp.ok] : undefined;

  const [lista, usuariosPorRol, permisosPorRol] = await Promise.all([
    db.select().from(roles).orderBy(asc(roles.name)),
    db.select({ roleId: users.roleId, total: count() }).from(users).groupBy(users.roleId),
    db.select({ roleId: rolePermissions.roleId, permission: rolePermissions.permission }).from(rolePermissions),
  ]);

  const usuarios = new Map(usuariosPorRol.map((r) => [r.roleId, r.total]));
  const orden = Object.keys(TIPOS_CUENTA);
  const ordenados = [...lista].sort(
    (a, b) => Number(b.fullAccess) - Number(a.fullAccess) || orden.indexOf(a.kind) - orden.indexOf(b.kind) || a.name.localeCompare(b.name),
  );

  return (
    <div className="w-full">
      <Encabezado
        seccion="Administración"
        titulo="Roles y permisos"
        descripcion="Cada rol define a qué módulos se puede entrar y qué se puede hacer en ellos."
      >
        {puedeCrear && (
          <Link href="/panel/roles/nuevo" className={clases.botonPrimario}>
            <IconoAccion accion="mas" /> Nuevo rol
          </Link>
        )}
      </Encabezado>

      {ok && <Aviso>{ok}</Aviso>}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ordenados.map((r) => {
          const permisos = permisosPorRol.filter((p) => p.roleId === r.id).map((p) => p.permission);
          const modulosVisibles = r.fullAccess ? MODULES : MODULES.filter((m) => permisos.includes(`${m.key}.ver`));
          const nUsuarios = usuarios.get(r.id) ?? 0;
          return (
            <li key={r.id}>
              <Link
                href={`/panel/roles/${r.id}`}
                className={`${clases.tarjeta} flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-borde-campo hover:shadow-md`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-texto">{r.name}</h2>
                  <span className="text-enlace" aria-hidden>
                    <IconoAccion accion={puedeEditar ? "editar" : "buscar"} />
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Insignia tono={TONO_TIPO[r.kind]}>{TIPOS_CUENTA[r.kind]}</Insignia>
                  {r.fullAccess && <Insignia tono="vino">Acceso total</Insignia>}
                  {r.isSystem && <Insignia>Rol base</Insignia>}
                </div>
                {r.description && <p className="mt-3 line-clamp-2 text-sm text-texto-suave">{r.description}</p>}

                <div className="mt-auto pt-4">
                  <div className="flex flex-wrap gap-1.5" aria-label="Módulos a los que puede entrar">
                    {modulosVisibles.slice(0, 8).map((m) => (
                      <span key={m.key} title={m.label} className="flex size-7 items-center justify-center rounded-lg bg-superficie-2 text-texto-suave">
                        <IconoModulo modulo={m.key} className="size-4" />
                      </span>
                    ))}
                    {modulosVisibles.length > 8 && (
                      <span className="flex h-7 items-center rounded-lg bg-superficie-2 px-2 text-xs text-texto-suave">+{modulosVisibles.length - 8}</span>
                    )}
                    {modulosVisibles.length === 0 && <span className="text-xs text-texto-suave">Sin módulos todavía</span>}
                  </div>
                  <p className="mt-3 flex justify-between border-t border-borde pt-3 text-sm text-texto-suave">
                    <span>
                      {nUsuarios} {nUsuarios === 1 ? "usuario" : "usuarios"}
                    </span>
                    <span>{r.fullAccess ? "Todos los módulos" : `${modulosVisibles.length} de ${MODULES.length} módulos`}</span>
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
