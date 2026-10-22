import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, ilike, inArray, lt, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { eventTypes, novaPackages, quoteItems, quoteVersions, quotes } from "@/db/schema";
import { requireEquipo } from "@/lib/auth";
import { totalesVersion } from "@/lib/cotizacion/calculo";
import { formatoBs } from "@/lib/cotizacion/dinero";
import { estaCongelada, leerLineaCongelada, leerVersionCongelada } from "@/lib/cotizacion/propuesta";
import { fechaCorta, hoy as hoyFn } from "@/lib/fechas";
import { hasPermission } from "@/lib/permissions";
import { IconoAccion } from "@/components/iconos";
import { Aviso, Encabezado, clases } from "@/components/ui";
import { ETIQUETAS_ESTADO, InsigniaEstado } from "./_armado/estado-cotizacion";

export const metadata: Metadata = { title: "Cotizaciones" };
export const instant = false;

const ESTADOS = ["draft", "sent", "accepted", "rejected", "cancelled", "vencida"] as const;

const MENSAJES: Record<string, string> = {
  eliminada: "Cotización eliminada.",
};

export default async function CotizacionesPage({ searchParams }: PageProps<"/panel/cotizaciones">) {
  const yo = await requireEquipo("cotizaciones.ver");
  const puedeCrear = hasPermission(yo, "cotizaciones.crear");
  const puedeEditar = hasPermission(yo, "cotizaciones.editar");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const estado = ESTADOS.find((e) => e === sp.estado) ?? "";
  const tipoFiltro = typeof sp.tipo === "string" ? sp.tipo : "";
  const hoy = await hoyFn();
  const ok = typeof sp.ok === "string" ? MENSAJES[sp.ok] : undefined;

  const tipos = await db.select({ id: eventTypes.id, name: eventTypes.name }).from(eventTypes).orderBy(asc(eventTypes.sortOrder), asc(eventTypes.name));

  const filtros: SQL[] = [];
  if (q) {
    const patron = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    filtros.push(or(ilike(quotes.clientName, patron), ilike(quotes.code, patron))!);
  }
  if (estado === "vencida") filtros.push(and(eq(quotes.status, "sent"), lt(quotes.validUntil, hoy))!);
  else if (estado) filtros.push(eq(quotes.status, estado));
  if (tipos.some((t) => t.id === tipoFiltro)) filtros.push(eq(quotes.eventTypeId, tipoFiltro));

  const lista = await db
    .select({
      id: quotes.id,
      code: quotes.code,
      clientName: quotes.clientName,
      tipo: eventTypes.name,
      eventDate: quotes.eventDate,
      guests: quotes.guests,
      status: quotes.status,
      validUntil: quotes.validUntil,
      acceptedVersionId: quotes.acceptedVersionId,
    })
    .from(quotes)
    .innerJoin(eventTypes, eq(quotes.eventTypeId, eventTypes.id))
    .where(filtros.length ? and(...filtros) : undefined)
    .orderBy(desc(quotes.createdAt));

  // Total de la versión principal (la aceptada, o la primera por orden): proveedores + paquete Nova.
  const totales = await totalesPrincipales(lista);
  const hayFiltros = Boolean(q || estado || tipoFiltro);

  return (
    <div className="w-full">
      <Encabezado seccion="Eventos" titulo="Cotizaciones" descripcion="Propuestas para clientes, con sus opciones y proveedores.">
        {puedeEditar && (
          <Link href="/panel/cotizaciones/ajustes" className={clases.botonSecundario}>
            Ajustes
          </Link>
        )}
        {puedeCrear && (
          <Link href="/panel/cotizaciones/nueva" className={clases.botonPrimario}>
            <IconoAccion accion="mas" /> Nueva cotización
          </Link>
        )}
      </Encabezado>

      {ok && <Aviso>{ok}</Aviso>}

      {/* Filtros: un formulario GET, así los filtros quedan en la URL */}
      <form className={`${clases.tarjeta} mb-5 grid gap-3 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center`}>
        <label className="relative block">
          <span className="sr-only">Buscar</span>
          <IconoAccion accion="buscar" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave" />
          <input name="q" defaultValue={q} placeholder="Buscar por cliente o código" className={`${clases.campo} pl-9`} />
        </label>
        <label className="block">
          <span className="sr-only">Estado</span>
          <select name="estado" defaultValue={estado} className={clases.campo}>
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ETIQUETAS_ESTADO[e]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Tipo de evento</span>
          <select name="tipo" defaultValue={tipoFiltro} className={clases.campo}>
            <option value="">Todos los tipos</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className={`${clases.botonSecundario} flex-1`}>
            Filtrar
          </button>
          {hayFiltros && (
            <Link href="/panel/cotizaciones" className={`${clases.botonSecundario} flex-1`}>
              Limpiar
            </Link>
          )}
        </div>
      </form>

      <p className="mb-3 text-sm text-texto-suave">
        {lista.length} {lista.length === 1 ? "cotización" : "cotizaciones"}
        {hayFiltros && " con estos filtros"}
      </p>

      {lista.length === 0 ? (
        <div className={`${clases.tarjeta} p-10 text-center`}>
          <p className="font-semibold text-texto">No hay cotizaciones{hayFiltros ? " con estos filtros" : ""}</p>
          <p className="mt-1 text-sm text-texto-suave">
            {hayFiltros ? "Prueba con otra búsqueda." : puedeCrear ? "Crea la primera con «Nueva cotización»." : "Todavía no se creó ninguna."}
          </p>
        </div>
      ) : (
        <>
          {/* Computadora: tabla */}
          <div className={`${clases.tarjeta} hidden overflow-hidden md:block`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-borde bg-superficie-2 text-xs tracking-wide text-texto-suave uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Cotización</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Evento</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Invitados</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Total</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Estado</th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {lista.map((c) => (
                  <tr key={c.id} className="transition hover:bg-superficie-2/60">
                    <td className="px-5 py-3.5">
                      <Link href={`/panel/cotizaciones/${c.id}`} className="font-semibold text-texto hover:text-titulo">
                        {c.clientName}
                      </Link>
                      <p className="text-xs text-texto-suave">{c.code}</p>
                    </td>
                    <td className="px-5 py-3.5 text-texto-suave">
                      {c.tipo} · {fechaCorta(c.eventDate)} {c.eventDate.slice(0, 4)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-texto-suave">{c.guests ?? "—"}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-texto">{formatoBs(totales.get(c.id) ?? 0)}</td>
                    <td className="px-5 py-3.5">
                      <InsigniaEstado status={c.status} validUntil={c.validUntil} hoy={hoy} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/panel/cotizaciones/${c.id}`}
                        aria-label={`Ver detalle de ${c.clientName}`}
                        className={`${clases.botonSecundario} px-3 py-1.5 whitespace-nowrap`}
                      >
                        Ver detalle <IconoAccion accion="siguiente" className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular y tablet: tarjetas */}
          <ul className="grid gap-3 sm:grid-cols-2 md:hidden">
            {lista.map((c) => (
              <li key={c.id}>
                <Link href={`/panel/cotizaciones/${c.id}`} className={`${clases.tarjeta} block p-4 transition hover:border-borde-campo`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-texto">{c.clientName}</p>
                      <p className="text-xs text-texto-suave">{c.code}</p>
                    </div>
                    <InsigniaEstado status={c.status} validUntil={c.validUntil} hoy={hoy} />
                  </div>
                  <p className="mt-3 text-sm text-texto-suave">
                    {c.tipo} · {fechaCorta(c.eventDate)} {c.eventDate.slice(0, 4)} · {c.guests ?? "—"} invitados
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-base font-semibold text-titulo">{formatoBs(totales.get(c.id) ?? 0)}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primario">
                      Ver detalle <IconoAccion accion="siguiente" className="size-3.5" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * Total de la versión principal de cada cotización (id de cotización → centavos):
 * la aceptada (también en una cancelada) con su copia congelada; si no, la primera por orden.
 */
async function totalesPrincipales(cotizaciones: { id: string; status: string; acceptedVersionId: string | null }[]) {
  const out = new Map<string, number>();
  const ids = cotizaciones.map((c) => c.id);
  if (!ids.length) return out;
  const aceptadas = new Map(cotizaciones.flatMap((c) => (estaCongelada(c.status) && c.acceptedVersionId ? [[c.id, c.acceptedVersionId] as const] : [])));
  const versiones = await db
    .select()
    .from(quoteVersions)
    .where(inArray(quoteVersions.quoteId, ids))
    .orderBy(asc(quoteVersions.sortOrder), asc(quoteVersions.name));
  const principal = new Map<string, (typeof versiones)[number]>();
  for (const v of versiones) if (!principal.has(v.quoteId) || aceptadas.get(v.quoteId) === v.id) principal.set(v.quoteId, v);
  const idsVersion = [...principal.values()].map((v) => v.id);
  if (!idsVersion.length) return out;

  const [lineas, paquetes] = await Promise.all([
    db.select({ versionId: quoteItems.versionId, total: quoteItems.totalCents, frozen: quoteItems.frozen }).from(quoteItems).where(inArray(quoteItems.versionId, idsVersion)),
    db.select({ id: novaPackages.id, precio: novaPackages.priceCents }).from(novaPackages),
  ]);
  const precioPaquete = new Map(paquetes.map((p) => [p.id, p.precio]));
  for (const [quoteId, v] of principal) {
    const congelada = aceptadas.get(quoteId) === v.id;
    const nova =
      (congelada ? leerVersionCongelada(v.frozen)?.precio : undefined) ??
      v.novaPriceCents ??
      (v.novaPackageId ? (precioPaquete.get(v.novaPackageId) ?? null) : null);
    const propias = lineas
      .filter((l) => l.versionId === v.id)
      .map((l) => ({ total: (congelada ? leerLineaCongelada(l.frozen)?.total : undefined) ?? l.total }));
    out.set(quoteId, totalesVersion(propias, nova).general);
  }
  return out;
}
