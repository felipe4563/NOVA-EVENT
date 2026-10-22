import type { Metadata } from "next";
import Link from "next/link";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  or,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  supplierBusy,
  supplierCategories,
  supplierMedia,
  suppliers,
  users,
} from "@/db/schema";
import { requireEquipo } from "@/lib/auth";
import { fechaCorta, hoy } from "@/lib/fechas";
import { hasPermission } from "@/lib/permissions";
import { IconoAccion } from "@/components/iconos";
import { Aviso, Encabezado, Insignia, clases } from "@/components/ui";
import { urlArchivo } from "./datos";

export const metadata: Metadata = { title: "Proveedores" };
export const instant = false;

const MENSAJES: Record<string, string> = {
  eliminado: "Proveedor eliminado.",
};

export default async function ProveedoresPage({
  searchParams,
}: PageProps<"/panel/proveedores">) {
  const yo = await requireEquipo("proveedores.ver");
  const puedeCrear = hasPermission(yo, "proveedores.crear");
  const puedeEditar = hasPermission(yo, "proveedores.editar");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const cat = typeof sp.cat === "string" ? sp.cat : "";
  const estado =
    sp.estado === "activos" || sp.estado === "inactivos" ? sp.estado : "";
  const ok = typeof sp.ok === "string" ? MENSAJES[sp.ok] : undefined;

  const categorias = await db
    .select({ id: supplierCategories.id, name: supplierCategories.name })
    .from(supplierCategories)
    .orderBy(asc(supplierCategories.sortOrder), asc(supplierCategories.name));

  const filtros: SQL[] = [];
  if (q) {
    const patron = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    filtros.push(
      or(
        ilike(suppliers.name, patron),
        ilike(suppliers.contactName, patron),
        ilike(suppliers.services, patron),
      )!,
    );
  }
  if (categorias.some((c) => c.id === cat))
    filtros.push(eq(suppliers.categoryId, cat));
  if (estado) filtros.push(eq(suppliers.active, estado === "activos"));

  const dia = await hoy();
  const [lista, accesos, proximos, portadas] = await Promise.all([
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        contactName: suppliers.contactName,
        phone: suppliers.phone,
        email: suppliers.email,
        active: suppliers.active,
        categoria: supplierCategories.name,
      })
      .from(suppliers)
      .innerJoin(
        supplierCategories,
        eq(suppliers.categoryId, supplierCategories.id),
      )
      .where(filtros.length ? and(...filtros) : undefined)
      .orderBy(asc(supplierCategories.sortOrder), asc(suppliers.name)),
    db
      .select({ supplierId: users.supplierId, total: count() })
      .from(users)
      .groupBy(users.supplierId),
    // Próximo día ocupado de cada proveedor
    db
      .selectDistinctOn([supplierBusy.supplierId], {
        supplierId: supplierBusy.supplierId,
        date: supplierBusy.date,
      })
      .from(supplierBusy)
      .where(gte(supplierBusy.date, dia))
      .orderBy(supplierBusy.supplierId, asc(supplierBusy.date)),
    // Portada: la marcada, o si no hay, la foto más reciente
    db
      .selectDistinctOn([supplierMedia.supplierId], {
        supplierId: supplierMedia.supplierId,
        thumbKey: supplierMedia.thumbKey,
      })
      .from(supplierMedia)
      .where(eq(supplierMedia.kind, "photo"))
      .orderBy(
        supplierMedia.supplierId,
        desc(supplierMedia.isCover),
        desc(supplierMedia.createdAt),
      ),
  ]);
  const nAccesos = new Map(accesos.map((a) => [a.supplierId, a.total]));
  const proximo = new Map(proximos.map((p) => [p.supplierId, p.date]));
  const portada = new Map(
    portadas.map((p) => [p.supplierId, urlArchivo(p.thumbKey)]),
  );
  const hayFiltros = Boolean(q || cat || estado);

  return (
    <div className="w-full">
      <Encabezado
        seccion="Proveedores"
        titulo="Proveedores"
        descripcion="Salones, música, catering y todos los que trabajan en los eventos."
      >
        <Link
          href={`/panel/calendario${cat ? `?cat=${cat}` : ""}`}
          className={clases.botonSecundario}
        >
          <IconoAccion accion="reloj" /> Disponibilidad
        </Link>
        {puedeEditar && (
          <Link
            href="/panel/proveedores/categorias"
            className={clases.botonSecundario}
          >
            <IconoAccion accion="etiqueta" /> Categorías
          </Link>
        )}
        {puedeCrear && (
          <Link
            href="/panel/proveedores/nuevo"
            className={clases.botonPrimario}
          >
            <IconoAccion accion="mas" /> Nuevo proveedor
          </Link>
        )}
      </Encabezado>

      {ok && <Aviso>{ok}</Aviso>}

      <form
        className={`${clases.tarjeta} mb-5 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center`}
      >
        <label className="relative block sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Buscar</span>
          <IconoAccion
            accion="buscar"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave"
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, contacto o servicio"
            className={`${clases.campo} pl-9`}
          />
        </label>
        <label className="block">
          <span className="sr-only">Categoría</span>
          <select name="cat" defaultValue={cat} className={clases.campo}>
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Estado</span>
          <select name="estado" defaultValue={estado} className={clases.campo}>
            <option value="">Activos e inactivos</option>
            <option value="activos">Solo activos</option>
            <option value="inactivos">Solo inactivos</option>
          </select>
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <button type="submit" className={`${clases.botonSecundario} flex-1`}>
            Filtrar
          </button>
          {hayFiltros && (
            <Link
              href="/panel/proveedores"
              className={`${clases.botonSecundario} flex-1`}
            >
              Limpiar
            </Link>
          )}
        </div>
      </form>

      <p className="mb-3 text-sm text-texto-suave">
        {lista.length} {lista.length === 1 ? "proveedor" : "proveedores"}
        {hayFiltros && " con estos filtros"}
      </p>

      {lista.length === 0 ? (
        <div className={`${clases.tarjeta} p-10 text-center`}>
          <p className="font-semibold text-texto">
            No hay proveedores{hayFiltros ? " con estos filtros" : " todavía"}
          </p>
          <p className="mt-1 text-sm text-texto-suave">
            {hayFiltros
              ? "Prueba con otra búsqueda."
              : puedeCrear
                ? "Agrega el primero con «Nuevo proveedor»."
                : "Cuando el equipo agregue proveedores aparecerán aquí."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {lista.map((p) => {
            const cuentas = nAccesos.get(p.id) ?? 0;
            const ocupado = proximo.get(p.id);
            const foto = portada.get(p.id);
            return (
              <li key={p.id}>
                <Link
                  href={`/panel/proveedores/${p.id}`}
                  className={`${clases.tarjeta} flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-borde-campo hover:shadow-md ${p.active ? "" : "opacity-70"}`}
                >
                  {foto && (
                    // eslint-disable-next-line @next/next/no-img-element -- imagen privada, ya optimizada
                    <img
                      src={foto}
                      alt=""
                      loading="lazy"
                      className="aspect-[16/9] w-full object-cover"
                    />
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start gap-3">
                      <span
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-activo text-base font-semibold text-titulo"
                        aria-hidden
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate font-semibold text-texto">
                          {p.name}
                        </h2>
                        <p className="truncate text-sm text-texto-suave">
                          {p.categoria}
                        </p>
                      </div>
                      {!p.active && <Insignia tono="error">Inactivo</Insignia>}
                    </div>

                    <dl className="mt-4 space-y-1.5 text-sm text-texto-suave">
                      {p.contactName && (
                        <div className="flex items-center gap-2">
                          <dt className="sr-only">Contacto</dt>
                          <IconoAccion
                            accion="usuario"
                            className="size-4 shrink-0"
                          />
                          <dd className="truncate">{p.contactName}</dd>
                        </div>
                      )}
                      {p.phone && (
                        <div className="flex items-center gap-2">
                          <dt className="sr-only">Teléfono</dt>
                          <IconoAccion
                            accion="telefono"
                            className="size-4 shrink-0"
                          />
                          <dd className="truncate">{p.phone}</dd>
                        </div>
                      )}
                      {p.email && (
                        <div className="flex items-center gap-2">
                          <dt className="sr-only">Correo</dt>
                          <IconoAccion
                            accion="correo"
                            className="size-4 shrink-0"
                          />
                          <dd className="truncate">{p.email}</dd>
                        </div>
                      )}
                    </dl>

                    <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                      {ocupado ? (
                        <Insignia tono="oro">
                          Próximo ocupado: {fechaCorta(ocupado)}
                        </Insignia>
                      ) : (
                        <Insignia tono="agua">Sin días ocupados</Insignia>
                      )}
                      <Insignia>
                        {cuentas
                          ? `${cuentas} ${cuentas === 1 ? "acceso" : "accesos"}`
                          : "Sin acceso al sistema"}
                      </Insignia>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
