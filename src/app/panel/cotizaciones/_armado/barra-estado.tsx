"use client";

import { useRef, useState, useTransition } from "react";
import { IconoAccion } from "@/components/iconos";
import { clases } from "@/components/ui";
import { type EstadoManual, type EstadoQuote, estadosPermitidos, sePuedeAceptar } from "@/lib/cotizacion/aceptacion";
import { formatoBs } from "@/lib/cotizacion/dinero";
import { aceptarVersion, marcarEstado } from "../estado-actions";

const TEXTO_ESTADO: Record<EstadoManual, string> = {
  sent: "Marcar enviada",
  rejected: "Marcar rechazada",
  draft: "Volver a borrador",
};

export type VersionAceptable = { id: string; name: string; total: number };

/** Acciones de estado (solo con «Cotizaciones: editar» y si no está aceptada). */
export function BarraEstado({ quoteId, status, versiones, activaId }: { quoteId: string; status: EstadoQuote; versiones: VersionAceptable[]; activaId: string | null }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const estados = estadosPermitidos(status);
  const ejecutar = (accion: () => Promise<string | void>) => {
    setError(null);
    iniciar(async () => {
      const r = await accion();
      if (r) setError(r);
    });
  };

  return (
    <section aria-label="Estado de la cotización" className={`${clases.tarjeta} space-y-3 p-4 sm:px-6`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-texto-suave">
          {status === "rejected" ? "El cliente rechazó esta cotización. Vuélvela a borrador para retomarla." : "Cuando el cliente elija una opción, márcala como aceptada."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {sePuedeAceptar(status) && versiones.length > 0 && <Aceptar quoteId={quoteId} versiones={versiones} activaId={activaId} />}
          {estados.map((e) => (
            <button key={e} type="button" disabled={pendiente} onClick={() => ejecutar(() => marcarEstado(quoteId, e))} className={`${clases.botonSecundario} px-3 py-2`}>
              {TEXTO_ESTADO[e]}
            </button>
          ))}
          {pendiente && <span className="text-sm text-texto-suave">Guardando…</span>}
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
    </section>
  );
}

/** «Aceptar»: ventana para elegir la versión que aceptó el cliente (si hay una sola, solo se confirma). */
function Aceptar({ quoteId, versiones, activaId }: { quoteId: string; versiones: VersionAceptable[]; activaId: string | null }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const inicial = versiones.find((v) => v.id === activaId)?.id ?? versiones[0].id;
  const [elegida, setElegida] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const varias = versiones.length > 1;

  function abrir() {
    setElegida(inicial);
    setError(null);
    dialogo.current?.showModal();
  }
  function confirmar() {
    setError(null);
    iniciar(async () => {
      const r = await aceptarVersion(quoteId, elegida);
      if (r) setError(r);
      else dialogo.current?.close();
    });
  }

  return (
    <>
      <button type="button" onClick={abrir} className={`${clases.botonPrimario} px-3 py-2`}>
        <IconoAccion accion="check" /> Aceptar
      </button>
      <dialog
        ref={dialogo}
        aria-labelledby="aceptar-titulo"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-borde bg-superficie p-0 text-texto shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="p-6">
          <h2 id="aceptar-titulo" className="text-lg font-semibold text-titulo">
            Marcar como aceptada
          </h2>
          <p className="mt-2 text-sm text-texto-suave">
            {varias ? "¿Qué opción aceptó el cliente? " : ""}
            Se guarda una copia de los precios y nombres tal como están hoy y ya no se puede editar. Cada proveedor queda «Por confirmar».
          </p>
          {varias && (
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">Versión aceptada</legend>
              {versiones.map((v) => (
                <label
                  key={v.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${elegida === v.id ? "border-primario bg-activo" : "border-borde hover:border-borde-campo"}`}
                >
                  <input type="radio" name="version" value={v.id} checked={elegida === v.id} onChange={() => setElegida(v.id)} className="size-4 accent-primario" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-texto">{v.name}</span>
                  <span className="text-sm text-texto-suave tabular-nums">{formatoBs(v.total)}</span>
                </label>
              ))}
              <p className={clases.ayuda}>Las demás quedan archivadas (se pueden ver, no editar).</p>
            </fieldset>
          )}
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => dialogo.current?.close()} className={clases.botonSecundario} disabled={pendiente}>
              Cancelar
            </button>
            <button type="button" onClick={confirmar} disabled={pendiente} className={clases.botonPrimario}>
              {pendiente ? "Procesando…" : "Aceptar cotización"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
