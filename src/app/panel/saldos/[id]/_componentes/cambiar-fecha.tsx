"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { IconoAccion } from "@/components/iconos";
import { Aviso, Campo, Insignia, clases } from "@/components/ui";
import { type EstadoFecha, type LineaRevision, cambiarFecha, revisarFecha } from "../../evento-actions";
import { Ventana } from "./ventana";

const ESTADO: Record<LineaRevision["estado"], { texto: string; tono: "agua" | "oro" | "error" }> = {
  libre: { texto: "Libre", tono: "agua" },
  parcial: { texto: "Ocupado algunas horas", tono: "oro" },
  ocupado: { texto: "Ocupado", tono: "error" },
};

/**
 * Cambiar la fecha del evento en dos pasos: elegir la fecha y «Revisar» (cómo quedan los proveedores confirmados),
 * luego «Cambiar fecha» o, si alguno está ocupado, «Cambiar de todos modos».
 */
export function CambiarFecha({
  quoteId,
  fechaActual,
  horarioActual,
  manana,
  puedeAjustar,
}: {
  quoteId: string;
  /** «sábado 14 de noviembre de 2026» */
  fechaActual: string;
  /** «18:00 – 23:00» o «Todo el día» */
  horarioActual: string;
  /** Primer día que se puede elegir (AAAA-MM-DD). */
  manana: string;
  /** Puede agregar ajustes («Saldos: crear»): el recordatorio lleva al botón. */
  puedeAjustar: boolean;
}) {
  return (
    <Ventana
      boton={
        <>
          <IconoAccion accion="reloj" /> Cambiar fecha
        </>
      }
      claseBoton={clases.botonSecundario}
      titulo="Cambiar fecha del evento"
      descripcion={
        <>
          Ahora: <span className="font-medium text-texto">{fechaActual}</span> · {horarioActual}
        </>
      }
    >
      {(listo) => <Formulario quoteId={quoteId} manana={manana} puedeAjustar={puedeAjustar} listo={listo} />}
    </Ventana>
  );
}

function Formulario({ quoteId, manana, puedeAjustar, listo }: { quoteId: string; manana: string; puedeAjustar: boolean; listo: (mensaje?: string) => void }) {
  const [v, setV] = useState({ fecha: "", inicio: "", fin: "" });
  const [revision, setRevision] = useState<LineaRevision[] | null>(null);
  const [errorRevision, setErrorRevision] = useState<string | null>(null);
  const [forzar, setForzar] = useState(false);
  const [estado, enviar, pendiente] = useActionState(async (prev: EstadoFecha, fd: FormData) => {
    const r = await cambiarFecha(quoteId, prev, fd);
    if (r?.ok) {
      // Listo: la próxima vez la ventana empieza de cero.
      setV({ fecha: "", inicio: "", fin: "" });
      setRevision(null);
      setForzar(false);
      listo(r.ok);
    } else if (r?.error || r?.errores) {
      // Lo revisado ya no vale (p. ej. alguien ocupó a un proveedor): hay que volver a revisar.
      setRevision(null);
      setForzar(false);
    }
    return r;
  }, undefined);
  const [revisando, iniciar] = useTransition();
  const id = useId();
  const e = estado?.errores ?? {};
  const ocupados = revision?.filter((l) => l.estado === "ocupado") ?? [];

  // Cambiar la fecha o el horario obliga a revisar de nuevo.
  const cambiar = (campo: keyof typeof v) => (ev: React.ChangeEvent<HTMLInputElement>) => {
    setV({ ...v, [campo]: ev.target.value });
    setRevision(null);
    setErrorRevision(null);
    setForzar(false);
  };
  const revisar = () =>
    iniciar(async () => {
      const r = await revisarFecha(quoteId, v.fecha, v.inicio, v.fin);
      if (typeof r === "string") {
        setErrorRevision(r);
        setRevision(null);
      } else {
        setErrorRevision(null);
        setRevision(r);
      }
    });

  return (
    <form action={enviar} noValidate className="space-y-4">
      {(errorRevision || estado?.error) && <Aviso tipo="error">{errorRevision ?? estado?.error}</Aviso>}
      <Campo id={`${id}-fecha`} etiqueta="Nueva fecha" error={e.fecha}>
        <input
          id={`${id}-fecha`}
          name="fecha"
          type="date"
          min={manana}
          value={v.fecha}
          onChange={cambiar("fecha")}
          aria-invalid={Boolean(e.fecha) || undefined}
          className={clases.campo}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo id={`${id}-inicio`} etiqueta="Desde (opcional)" error={e.inicio}>
          <input id={`${id}-inicio`} name="inicio" type="time" value={v.inicio} onChange={cambiar("inicio")} aria-invalid={Boolean(e.inicio) || undefined} className={clases.campo} />
        </Campo>
        <Campo id={`${id}-fin`} etiqueta="Hasta (opcional)" error={e.fin}>
          <input id={`${id}-fin`} name="fin" type="time" value={v.fin} onChange={cambiar("fin")} aria-invalid={Boolean(e.fin) || undefined} className={clases.campo} />
        </Campo>
      </div>
      <p className="-mt-2 text-xs text-texto-suave">Sin horario se mantiene el actual.</p>

      {revision === null ? (
        <div className="flex justify-end">
          <button type="button" onClick={revisar} disabled={revisando || !v.fecha} className={clases.botonPrimario}>
            {revisando ? "Revisando…" : "Revisar"}
          </button>
        </div>
      ) : (
        <>
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-texto-suave uppercase">Proveedores confirmados</h3>
            {revision.length ? (
              <ul className="mt-1 divide-y divide-borde">
                {revision.map((l, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                    <span className="min-w-0 text-sm break-words text-texto">{l.proveedor}</span>
                    <Insignia tono={ESTADO[l.estado].tono}>{ESTADO[l.estado].texto}</Insignia>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-texto-suave">No hay proveedores confirmados: solo se mueven la fecha y las cuotas.</p>
            )}
          </div>
          {ocupados.length > 0 && (
            <label className="flex items-start gap-2 rounded-xl bg-error/10 px-3 py-2.5 text-sm text-error ring-1 ring-error/30 ring-inset">
              <input type="checkbox" name="forzar" checked={forzar} onChange={(ev) => setForzar(ev.target.checked)} className="mt-0.5 accent-primario" />
              <span>
                Cambiar de todos modos: {ocupados.map((l) => l.proveedor).join(", ")} {ocupados.length === 1 ? "queda" : "quedan"} «Por confirmar» y sin día reservado.
              </span>
            </label>
          )}
          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" onClick={() => setRevision(null)} className={clases.botonSecundario}>
              Elegir otra fecha
            </button>
            <button type="submit" disabled={pendiente || (ocupados.length > 0 && !forzar)} className={ocupados.length ? clases.botonPeligroSolido : clases.botonPrimario}>
              {pendiente ? (
                "Guardando…"
              ) : (
                <>
                  <IconoAccion accion="check" /> {ocupados.length ? "Cambiar de todos modos" : "Cambiar fecha"}
                </>
              )}
            </button>
          </div>
        </>
      )}

      <p className="border-t border-borde pt-3 text-xs text-texto-suave">
        Las cuotas pendientes se corren los mismos días; las pagadas no cambian.{" "}
        {puedeAjustar ? (
          <>
            Si corresponde un recargo según la política,{" "}
            <a href="#cobros-titulo" onClick={() => listo()} className="font-medium text-enlace hover:text-titulo">
              agrégalo como ajuste
            </a>
            .
          </>
        ) : (
          "Si corresponde un recargo según la política, agrégalo como ajuste."
        )}
      </p>
    </form>
  );
}
