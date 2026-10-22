"use client";

import Link from "next/link";
import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { BotonConfirmar } from "@/components/boton-confirmar";
import { IconoAccion } from "@/components/iconos";
import { Insignia, clases } from "@/components/ui";
import { formatoBs } from "@/lib/cotizacion/dinero";
import { alternarVisible, crearVersion, duplicarVersion, eliminarVersion, renombrarVersion } from "../actions";

export type PestanaVersion = {
  id: string;
  name: string;
  visible: boolean;
  total: number;
  /** En una cotización aceptada: la versión aceptada o las demás (archivadas, de solo lectura). */
  estado?: "aceptada" | "archivada";
};

/** Pestañas de las versiones (?v=) y acciones sobre la versión abierta. */
export function Versiones({
  quoteId,
  versiones,
  activa,
  editable,
}: {
  quoteId: string;
  versiones: PestanaVersion[];
  activa: PestanaVersion;
  editable: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // La casilla cambia al instante; si falla, vuelve sola al valor guardado.
  const [visible, setVisible] = useOptimistic(activa.visible);
  const ejecutar = (accion: () => Promise<string | void>) => {
    setError(null);
    iniciar(async () => {
      const r = await accion();
      if (r) setError(r);
    });
  };

  return (
    <section aria-label="Versiones" className="space-y-3">
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul role="tablist" className="flex w-max gap-2">
          {versiones.map((v) => {
            const actual = v.id === activa.id;
            return (
              <li key={v.id} role="presentation">
                <Link
                  role="tab"
                  aria-selected={actual}
                  href={`/panel/cotizaciones/${quoteId}?v=${v.id}`}
                  scroll={false}
                  className={`block rounded-xl border px-4 py-2 text-left transition ${
                    actual ? "border-primario bg-activo text-titulo shadow-sm" : "border-borde bg-superficie text-texto hover:border-borde-campo"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap">
                    {v.name}
                    {v.estado === "aceptada" && <span className="text-xs font-normal text-titulo">(aceptada)</span>}
                    {v.estado === "archivada" && <span className="text-xs font-normal text-texto-suave">(archivada)</span>}
                    {!v.estado && !v.visible && <span className="text-xs font-normal text-texto-suave">(oculta)</span>}
                  </span>
                  <span className="block text-xs text-texto-suave tabular-nums">{formatoBs(v.total)}</span>
                </Link>
              </li>
            );
          })}
          {editable && (
            <li>
              <button
                type="button"
                disabled={pendiente}
                onClick={() => ejecutar(() => crearVersion(quoteId))}
                className="flex h-full items-center gap-1.5 rounded-xl border border-dashed border-borde-campo px-4 py-2 text-sm font-medium whitespace-nowrap text-enlace transition hover:bg-superficie-2 disabled:opacity-60"
              >
                <IconoAccion accion="mas" /> Nueva versión
              </button>
            </li>
          )}
        </ul>
      </div>

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Renombrar key={activa.id + activa.name} version={activa} />
          <button type="button" disabled={pendiente} onClick={() => ejecutar(() => duplicarVersion(activa.id))} className={`${clases.botonSecundario} px-3 py-2`}>
            <IconoAccion accion="copiar" /> Duplicar
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-borde-campo bg-superficie px-3 py-2 text-sm text-texto">
            <input
              type="checkbox"
              checked={visible}
              disabled={pendiente}
              onChange={() =>
                ejecutar(() => {
                  setVisible(!visible);
                  return alternarVisible(activa.id);
                })
              }
              className="size-4 accent-primario"
            />
            Mostrar en la propuesta
          </label>
          {versiones.length > 1 && (
            <BotonConfirmar
              accion={() => eliminarVersion(activa.id)}
              titulo={`¿Eliminar «${activa.name}»?`}
              mensaje="Se borran esta versión y todas sus líneas. Las demás versiones no cambian."
              textoConfirmar="Eliminar versión"
              peligro
              className={`${clases.botonPeligro} px-3 py-2`}
            >
              <IconoAccion accion="basura" /> Eliminar
            </BotonConfirmar>
          )}
          {pendiente && <span className="text-sm text-texto-suave">Guardando…</span>}
        </div>
      )}
      {!editable && !activa.estado && !activa.visible && <Insignia>No se muestra en la propuesta</Insignia>}
      {activa.estado === "archivada" && <Insignia>Archivada: el cliente aceptó otra versión</Insignia>}
      {error && (
        <p role="alert" className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
    </section>
  );
}

function Renombrar({ version }: { version: PestanaVersion }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [estado, enviar, guardando] = useActionState(renombrarVersion.bind(null, version.id), undefined);
  useEffect(() => {
    if (estado?.ok) dialogo.current?.close();
  }, [estado]);
  const error = estado?.errores?.nombre ?? estado?.error;

  return (
    <>
      <button type="button" onClick={() => dialogo.current?.showModal()} className={`${clases.botonSecundario} px-3 py-2`}>
        <IconoAccion accion="editar" /> Renombrar
      </button>
      <dialog
        ref={dialogo}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-borde bg-superficie p-0 text-texto shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
      >
        <form action={enviar} noValidate key={JSON.stringify(estado ?? null)} className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-titulo">Nombre de la versión</h2>
          <label className="block">
            <span className={clases.etiqueta}>Nombre</span>
            <input
              name="nombre"
              defaultValue={estado?.valores?.nombre ?? version.name}
              maxLength={60}
              required
              autoComplete="off"
              aria-invalid={Boolean(error) || undefined}
              className={`${clases.campo} mt-1.5`}
            />
          </label>
          <p className={clases.ayuda}>Ej. «Opción jardín» o «Opción económica». El cliente lo verá en la propuesta.</p>
          {error && <p className={clases.error}>{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => dialogo.current?.close()} className={clases.botonSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className={clases.botonPrimario}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
