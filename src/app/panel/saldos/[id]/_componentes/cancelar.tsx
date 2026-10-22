"use client";

import { useActionState, useId, useState } from "react";
import { IconoAccion } from "@/components/iconos";
import { Aviso, Campo, clases } from "@/components/ui";
import { aCentavos, formatoBs } from "@/lib/cotizacion/dinero";
import { ETIQUETA_FORMA, FORMAS_PAGO } from "@/lib/saldos/recibo";
import { type EstadoCancelar, cancelarEvento } from "../../evento-actions";
import { Ventana } from "./ventana";

type Resumen = {
  cobrado: number;
  /** Primera cuota de la pareja. */
  anticipo: { nombre: string; monto: number } | null;
  pagadoProveedores: number;
  politica: string | null;
};

/** Cancelar el evento, con la devolución a la pareja si corresponde. Al lado, los números para decidir cuánto devolver. */
export function Cancelar({ quoteId, codigo, hoy, maxBytes, resumen }: { quoteId: string; codigo: string; hoy: string; maxBytes: number; resumen: Resumen }) {
  return (
    <Ventana
      boton={
        <>
          <IconoAccion accion="basura" /> Cancelar evento
        </>
      }
      claseBoton={clases.botonPeligro}
      titulo={`Cancelar ${codigo}`}
      descripcion="Se liberan los días reservados de los proveedores y el evento queda de solo lectura (solo se pueden registrar devoluciones)."
      ancho="w-[min(46rem,calc(100vw-2rem))]"
    >
      {(listo) => (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
          <Formulario quoteId={quoteId} hoy={hoy} maxBytes={maxBytes} limite={resumen.cobrado} listo={listo} />
          <Numeros r={resumen} />
        </div>
      )}
    </Ventana>
  );
}

function Numeros({ r }: { r: Resumen }) {
  const filas: [string, number][] = [
    ["Cobrado a la pareja", r.cobrado],
    ...(r.anticipo ? ([[`${r.anticipo.nombre} (primera cuota)`, r.anticipo.monto]] as [string, number][]) : []),
    ["Pagado a proveedores", r.pagadoProveedores],
  ];
  return (
    <aside className="order-first space-y-3 rounded-xl bg-superficie-2/60 p-3 md:order-none">
      <dl className="space-y-2">
        {filas.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-texto-suave">{k}</dt>
            <dd className="font-medium text-texto tabular-nums">{formatoBs(v)}</dd>
          </div>
        ))}
      </dl>
      {r.politica && (
        <div className="border-t border-borde pt-2">
          <p className="text-xs font-semibold tracking-wide text-texto-suave uppercase">Política de cancelación</p>
          <p className="mt-1 max-h-48 overflow-y-auto text-xs break-words whitespace-pre-line text-texto">{r.politica}</p>
        </div>
      )}
    </aside>
  );
}

function Formulario({ quoteId, hoy, maxBytes, limite, listo }: { quoteId: string; hoy: string; maxBytes: number; limite: number; listo: (mensaje?: string) => void }) {
  const [estado, enviar, pendiente] = useActionState(async (prev: EstadoCancelar, fd: FormData) => {
    const r = await cancelarEvento(quoteId, prev, fd);
    if (r?.ok) listo(r.ok);
    return r;
  }, undefined);
  // Sin devolución no se envía la fecha: al mostrarse de nuevo vuelve a ser hoy.
  const v = { motivo: "", monto: "0", forma: "", referencia: "", nota: "", ...estado?.valores, fecha: estado?.valores?.fecha || hoy };
  const [monto, setMonto] = useState(v.monto);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const id = useId();
  const e = { ...estado?.errores, ...(errorArchivo ? { comprobante: errorArchivo } : {}) };
  const mb = Math.round(maxBytes / 1024 / 1024);
  // Los datos de la devolución solo se piden si se devuelve algo.
  const devuelve = (aCentavos(monto || "0") ?? 1) > 0;

  return (
    <form action={enviar} noValidate className="min-w-0 space-y-4" key={JSON.stringify(estado ?? null)}>
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Campo id={`${id}-motivo`} etiqueta="Motivo" error={e.motivo}>
        <textarea id={`${id}-motivo`} name="motivo" rows={2} maxLength={300} defaultValue={v.motivo} aria-invalid={Boolean(e.motivo) || undefined} className={`${clases.campo} resize-y`} />
      </Campo>
      <Campo id={`${id}-monto`} etiqueta="Monto a devolver (Bs)" error={e.monto} ayuda={`De 0 a ${formatoBs(limite)} (lo cobrado). 0 si no se devuelve nada.`}>
        <input
          id={`${id}-monto`}
          name="monto"
          inputMode="decimal"
          placeholder="0"
          defaultValue={v.monto}
          onChange={(ev) => setMonto(ev.target.value)}
          aria-invalid={Boolean(e.monto) || undefined}
          className={`${clases.campo} tabular-nums`}
        />
      </Campo>

      {devuelve && (
        <fieldset className="space-y-4 rounded-xl border border-borde p-3">
          <legend className="px-1 text-xs font-semibold tracking-wide text-texto-suave uppercase">Devolución a la pareja</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id={`${id}-fecha`} etiqueta="Fecha" error={e.fecha}>
              <input id={`${id}-fecha`} name="fecha" type="date" max={hoy} defaultValue={v.fecha} aria-invalid={Boolean(e.fecha) || undefined} className={clases.campo} />
            </Campo>
            <Campo id={`${id}-forma`} etiqueta="Forma de pago" error={e.forma}>
              <select id={`${id}-forma`} name="forma" defaultValue={v.forma} aria-invalid={Boolean(e.forma) || undefined} className={clases.campo}>
                <option value="" disabled>
                  Elige…
                </option>
                {FORMAS_PAGO.map((f) => (
                  <option key={f} value={f}>
                    {ETIQUETA_FORMA[f]}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <Campo id={`${id}-referencia`} etiqueta="Referencia (opcional)" error={e.referencia}>
            <input id={`${id}-referencia`} name="referencia" maxLength={80} placeholder="N.º de operación" defaultValue={v.referencia} aria-invalid={Boolean(e.referencia) || undefined} className={clases.campo} />
          </Campo>
          <Campo
            id={`${id}-comprobante`}
            etiqueta="Comprobante (opcional)"
            error={e.comprobante}
            ayuda={estado?.archivo ? `Vuelve a elegir «${estado.archivo}».` : `Foto o PDF de hasta ${mb} MB.`}
          >
            <input
              id={`${id}-comprobante`}
              name="comprobante"
              type="file"
              accept="image/*,application/pdf"
              aria-invalid={Boolean(e.comprobante) || undefined}
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                if (f && f.size > maxBytes) {
                  setErrorArchivo(`El comprobante pesa más de ${mb} MB.`);
                  ev.target.value = "";
                } else setErrorArchivo(null);
              }}
              className="block w-full text-sm text-texto-suave file:mr-3 file:rounded-lg file:border file:border-borde-campo file:bg-superficie file:px-3 file:py-2 file:text-sm file:font-medium file:text-texto hover:file:bg-superficie-2"
            />
          </Campo>
          <Campo id={`${id}-nota`} etiqueta="Nota interna (opcional)" error={e.nota}>
            <textarea id={`${id}-nota`} name="nota" rows={2} maxLength={300} defaultValue={v.nota} aria-invalid={Boolean(e.nota) || undefined} className={`${clases.campo} resize-y`} />
          </Campo>
        </fieldset>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={pendiente} className={clases.botonPeligroSolido}>
          {pendiente ? "Cancelando…" : devuelve ? "Cancelar y registrar devolución" : "Cancelar evento"}
        </button>
      </div>
    </form>
  );
}
