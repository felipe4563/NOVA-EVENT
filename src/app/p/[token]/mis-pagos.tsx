// «Mis pagos» del enlace de la pareja. Server Component sin partes de cliente: solo recibe `CuentaPublica`,
// que ya viene sin nada de proveedores (pagos, montos a pagar, comprobantes, notas). Siempre claro, con la estética de la propuesta.
import { formatoBs } from "@/lib/cotizacion/dinero";
import { diasEntre, fechaCorta } from "@/lib/fechas";
import type { EstadoCuota } from "@/lib/saldos/plan";
import type { CuentaPublica } from "@/app/panel/saldos/datos";

/** ¿Hay algo que mostrar? Con plan, o cancelada con devolución. */
export const hayMisPagos = (c: CuentaPublica | null): c is CuentaPublica => !!c && (c.cuotas.length > 0 || (c.cancelada && c.devuelto > 0));

const TONOS = {
  agua: "bg-agua-100 text-agua-700 ring-agua-300",
  oro: "bg-oro-300/25 text-oro-700 ring-oro-300",
  vino: "bg-vino-600 text-white ring-vino-600",
  neutro: "bg-white text-carbon/70 ring-carbon/15",
} as const;

function Etiqueta({ tono, children }: { tono: keyof typeof TONOS; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${TONOS[tono]}`}>{children}</span>;
}

function InsigniaCuota({ estado, vence, hoy }: { estado: EstadoCuota; vence: string; hoy: string }) {
  if (estado === "pagada") return <Etiqueta tono="agua">Pagada</Etiqueta>;
  if (estado === "vencida") return <Etiqueta tono="vino">Vencida</Etiqueta>;
  if (estado === "por_vencer") {
    const dias = diasEntre(hoy, vence);
    return <Etiqueta tono="oro">{dias <= 0 ? "Vence hoy" : `Vence en ${dias} ${dias === 1 ? "día" : "días"}`}</Etiqueta>;
  }
  return <Etiqueta tono="neutro">{estado === "parcial" ? "Parcial" : "Pendiente"}</Etiqueta>;
}

const Rotulo = ({ children }: { children: React.ReactNode }) => <h3 className="text-[11px] font-semibold tracking-[0.3em] text-oro-700 uppercase">{children}</h3>;

export function MisPagos({ c, token, hoy }: { c: CuentaPublica; token: string; hoy: string }) {
  const falta = Math.max(0, c.total - c.cobrado);
  const pct = c.total > 0 ? Math.min(100, Math.round((c.cobrado / c.total) * 100)) : 0;
  const proxima = c.cancelada ? undefined : c.cuotas.find((q) => q.falta > 0);

  return (
    <section id="mis-pagos" aria-labelledby="mis-pagos-titulo" className="scroll-mt-4 bg-marmol-claro px-2 pb-8 [color-scheme:light] sm:px-5 lg:px-10">
      <div className="mx-auto max-w-2xl rounded-[1.25rem] bg-white p-5 text-carbon shadow-[0_20px_60px_-25px_rgb(70_24_39/0.45)] ring-1 ring-oro-300/70 sm:p-8">
        <h2 id="mis-pagos-titulo" className="font-display text-2xl text-vino-600 sm:text-3xl">
          Mis pagos
        </h2>

        {c.cancelada ? (
          <div role="status" className="mt-4 rounded-xl bg-vino-50/70 px-4 py-3 ring-1 ring-vino-100">
            <p className="font-display text-lg text-vino-700">Evento cancelado</p>
            {c.devuelto > 0 && (
              <p className="mt-1 text-sm">
                Devolución: <span className="font-semibold tabular-nums">{formatoBs(c.devuelto)}</span>
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="mt-4 font-display text-xl break-words text-vino-700 tabular-nums sm:text-2xl">
              {formatoBs(c.cobrado)} <span className="text-base text-carbon/60">de {formatoBs(c.total)}</span>
            </p>
            <div
              role="progressbar"
              aria-label="Pagado"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-vino-100"
            >
              <div className="h-full rounded-full bg-vino-600" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-sm text-carbon/70">
              {pct} % pagado · Falta <span className="font-semibold text-carbon tabular-nums">{formatoBs(falta)}</span>
            </p>

            {proxima ? (
              <div className="mt-5 rounded-xl bg-vino-50/60 p-4 ring-1 ring-vino-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-lg text-vino-700">Próxima cuota</p>
                  <InsigniaCuota estado={proxima.estado} vence={proxima.vence} hoy={hoy} />
                </div>
                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                  <span className="break-words">
                    {proxima.nombre} · {fechaCorta(proxima.vence)}
                  </span>
                  <span className="font-semibold tabular-nums">{formatoBs(proxima.falta)}</span>
                </div>
              </div>
            ) : (
              <p role="status" className="mt-5 rounded-xl bg-agua-100 px-4 py-3 font-display text-lg text-agua-700 ring-1 ring-agua-300">
                ¡Pagado por completo!
              </p>
            )}
          </>
        )}

        {c.cuotas.length > 0 && (
          <div className="mt-6">
            <Rotulo>Cuotas</Rotulo>
            <ul className="mt-1 divide-y divide-oro-300/40">
              {c.cuotas.map((q, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{q.nombre}</p>
                    <p className="text-xs text-carbon/60">{c.cancelada ? "Vencía" : "Vence"} {fechaCorta(q.vence)}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                    <span className="text-right">
                      <span className="block font-medium tabular-nums">{formatoBs(q.monto)}</span>
                      {!c.cancelada && q.falta > 0 && q.falta < q.monto && <span className="block text-xs text-carbon/60 tabular-nums">falta {formatoBs(q.falta)}</span>}
                    </span>
                    {!c.cancelada && <InsigniaCuota estado={q.estado} vence={q.vence} hoy={hoy} />}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {c.ajustes.length > 0 && (
          <div className="mt-6">
            <Rotulo>Ajustes</Rotulo>
            <ul className="mt-1 divide-y divide-oro-300/40">
              {c.ajustes.map((a, i) => (
                <li key={i} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
                  <span className="min-w-0 break-words">{a.concepto}</span>
                  <span className="font-medium tabular-nums">
                    {a.monto < 0 ? "−" : "+"}
                    {formatoBs(Math.abs(a.monto))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {c.recibos.length > 0 && (
          <div className="mt-6">
            <Rotulo>Recibos</Rotulo>
            <ul className="mt-1 divide-y divide-oro-300/40">
              {c.recibos.map((r) => (
                <li key={r.codigo} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                  <div>
                    <a
                      href={`/p/${token}/recibo/${r.codigo}`}
                      target="_blank"
                      rel="noopener"
                      className="font-medium text-vino-600 underline decoration-oro-500 underline-offset-4 hover:text-vino-800 focus-visible:ring-3 focus-visible:ring-oro-500 focus-visible:outline-none"
                    >
                      {r.codigo}
                    </a>
                    <p className="text-xs text-carbon/60">{fechaCorta(r.fecha)}</p>
                  </div>
                  <span className="font-medium tabular-nums">{formatoBs(r.monto)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {c.directos.length > 0 && (
          <div className="mt-6">
            <Rotulo>Se paga directo al proveedor</Rotulo>
            <ul className="mt-1 divide-y divide-oro-300/40">
              {c.directos.map((d, i) => (
                <li key={i} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
                  <span className="min-w-0 break-words">{d.proveedor}</span>
                  <span className="font-medium tabular-nums">{formatoBs(d.monto)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {c.politica && (
          <details className="mt-6 rounded-xl bg-vino-50/60 px-4 py-3 ring-1 ring-vino-100">
            <summary className="cursor-pointer font-medium text-vino-700">Política de cambios y cancelación</summary>
            <p className="mt-2 text-sm break-words whitespace-pre-line text-carbon/80">{c.politica}</p>
          </details>
        )}
      </div>
    </section>
  );
}
