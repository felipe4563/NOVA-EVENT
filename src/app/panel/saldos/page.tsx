import type { Metadata } from "next";
import Link from "next/link";
import { requireEquipo } from "@/lib/auth";
import { fechaCorta, hoy as hoyFn } from "@/lib/fechas";
import { IconoAccion } from "@/components/iconos";
import { Encabezado, Insignia, clases } from "@/components/ui";
import { InsigniaEstado } from "../cotizaciones/_armado/estado-cotizacion";
import { listaSaldos, resumenGeneral, type FilaSaldo, type FiltroSaldos } from "./datos";
import { InsigniaCuota } from "./insignia-cuota";
import { TarjetasSaldos } from "./tarjetas";

export const metadata: Metadata = { title: "Saldos pendientes" };
export const instant = false;

const ESTADOS = [
  ["vencidos", "Vencidos"],
  ["por_vencer", "Por vencer"],
  ["al_dia", "Al día"],
  ["pagado", "Pagados"],
  ["canceladas", "Canceladas"],
] as const;

export default async function SaldosPage({ searchParams }: PageProps<"/panel/saldos">) {
  await requireEquipo("saldos.ver");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const estado: FiltroSaldos["estado"] = ESTADOS.find(([e]) => e === sp.estado)?.[0] ?? "";
  const hoy = await hoyFn();
  const [lista, resumen] = await Promise.all([listaSaldos({ q, estado }, hoy), resumenGeneral(hoy)]);
  const hayFiltros = Boolean(q || estado);

  return (
    <div className="w-full">
      <Encabezado seccion="Finanzas" titulo="Saldos pendientes" descripcion="Cobros a las parejas y pagos a proveedores de cada evento." />

      <div className="mb-5">
        <TarjetasSaldos r={resumen} completa />
      </div>

      {/* Filtros: un formulario GET, así quedan en la URL */}
      <form className={`${clases.tarjeta} mb-5 grid gap-3 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center`}>
        <label className="relative block">
          <span className="sr-only">Buscar</span>
          <IconoAccion accion="buscar" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave" />
          <input name="q" defaultValue={q} placeholder="Buscar por cliente o código" className={`${clases.campo} pl-9`} />
        </label>
        <label className="block">
          <span className="sr-only">Estado</span>
          <select name="estado" defaultValue={estado} className={clases.campo}>
            <option value="">Todos</option>
            {ESTADOS.map(([e, t]) => (
              <option key={e} value={e}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className={`${clases.botonSecundario} flex-1`}>
            Filtrar
          </button>
          {hayFiltros && (
            <Link href="/panel/saldos" className={`${clases.botonSecundario} flex-1`}>
              Limpiar
            </Link>
          )}
        </div>
      </form>

      {lista.length === 0 ? (
        <div className={`${clases.tarjeta} p-10 text-center`}>
          <p className="font-semibold text-texto">{hayFiltros ? "No hay eventos con estos filtros." : "Todavía no hay cotizaciones aceptadas."}</p>
          {hayFiltros && <p className="mt-1 text-sm text-texto-suave">Prueba con otra búsqueda.</p>}
        </div>
      ) : (
        <>
          {/* Computadora: tabla */}
          <div className={`${clases.tarjeta} hidden overflow-hidden md:block`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-borde bg-superficie-2 text-xs tracking-wide text-texto-suave uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Evento</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Fecha</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Cobrado</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Próximo vencimiento</th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {lista.map((f) => (
                  <tr key={f.id} className="transition hover:bg-superficie-2/60">
                    <td className="px-5 py-3.5">
                      <Link href={`/panel/saldos/${f.id}`} className="font-semibold text-texto hover:text-titulo">
                        {f.clientName}
                      </Link>
                      <p className="text-xs text-texto-suave">{f.code}</p>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-texto-suave">
                      {fechaCorta(f.eventDate)} {f.eventDate.slice(0, 4)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-texto tabular-nums">{f.status === "cancelled" ? "—" : `${f.pct} %`}</td>
                    <td className="px-5 py-3.5">
                      <Proximo f={f} hoy={hoy} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/panel/saldos/${f.id}`} aria-label={`Ver detalle de ${f.clientName}`} className={`${clases.botonSecundario} px-3 py-1.5 whitespace-nowrap`}>
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
            {lista.map((f) => (
              <li key={f.id}>
                <Link href={`/panel/saldos/${f.id}`} className={`${clases.tarjeta} block p-4 transition hover:border-borde-campo`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-texto">{f.clientName}</p>
                      <p className="text-xs text-texto-suave">{f.code}</p>
                    </div>
                    <p className="shrink-0 text-sm text-texto-suave">
                      {fechaCorta(f.eventDate)} {f.eventDate.slice(0, 4)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <p className="text-sm text-texto-suave">
                      Cobrado <span className="font-semibold text-texto tabular-nums">{f.status === "cancelled" ? "—" : `${f.pct} %`}</span>
                    </p>
                    <Proximo f={f} hoy={hoy} />
                  </div>
                  <p className="mt-2 text-right">
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primario">
                      Ver detalle <IconoAccion accion="siguiente" className="size-3.5" />
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Próxima cuota con su estado; en canceladas, la insignia de estado de la cotización. */
function Proximo({ f, hoy }: { f: FilaSaldo; hoy: string }) {
  if (f.status === "cancelled") return <InsigniaEstado status="cancelled" validUntil={null} hoy={hoy} />;
  if (!f.proximo) return f.cobrado >= f.total ? <Insignia tono="agua">Pagado</Insignia> : <Insignia>Sin plan de pagos</Insignia>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-sm text-texto-suave">
        {f.proximo.nombre} · {fechaCorta(f.proximo.vence)}
      </span>
      <InsigniaCuota estado={f.proximo.estado} vence={f.proximo.vence} hoy={hoy} />
    </span>
  );
}
