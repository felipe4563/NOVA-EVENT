"use client";

import { BotonConfirmar } from "@/components/boton-confirmar";
import { IconoAccion } from "@/components/iconos";
import { clases } from "@/components/ui";
import { eliminarCotizacion, reabrirCotizacion } from "../estado-actions";

/**
 * Reabrir (aceptada, con «editar») y eliminar (con «eliminar»; una aceptada hay que reabrirla primero).
 * `liberar`: proveedores cuyo día ocupado se quita al reabrir.
 */
export function ZonaDelicada({
  quoteId,
  codigo,
  aceptada,
  puedeReabrir,
  puedeEliminar,
  liberar,
  dia,
}: {
  quoteId: string;
  codigo: string;
  aceptada: boolean;
  puedeReabrir: boolean;
  puedeEliminar: boolean;
  liberar: string[];
  dia: string;
}) {
  const reabrir = aceptada && puedeReabrir;
  if (!reabrir && !puedeEliminar) return null;
  const mensajeReabrir = liberar.length
    ? `Vuelve a Borrador y se puede editar otra vez. Se quitará el día ocupado del ${dia} de: ${liberar.join(", ")}.`
    : "Vuelve a Borrador y se puede editar otra vez. No hay días ocupados que quitar.";

  return (
    <section aria-labelledby="zona-delicada" className="rounded-2xl border border-error/30 p-4 sm:px-6">
      <h2 id="zona-delicada" className="font-display text-lg text-titulo">
        Zona delicada
      </h2>
      <div className="mt-3 space-y-4">
        {reabrir && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-texto-suave">
              Reabrir la cotización la vuelve a Borrador, se descongela y se quitan los días ocupados de los proveedores confirmados
              {liberar.length ? ` (${liberar.join(", ")})` : ""}.
            </p>
            <BotonConfirmar
              accion={() => reabrirCotizacion(quoteId)}
              titulo={`¿Reabrir ${codigo}?`}
              mensaje={mensajeReabrir}
              textoConfirmar="Reabrir"
              peligro
              className={`${clases.botonPeligro} shrink-0 px-3 py-2`}
            >
              Reabrir
            </BotonConfirmar>
          </div>
        )}
        {puedeEliminar && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-texto-suave">
              {aceptada ? "Una cotización aceptada no se elimina: reábrela primero." : "Se borran la cotización, sus versiones y líneas. No se puede deshacer."}
            </p>
            {aceptada ? (
              <button type="button" disabled className={`${clases.botonPeligro} shrink-0 px-3 py-2`}>
                <IconoAccion accion="basura" /> Eliminar
              </button>
            ) : (
              <BotonConfirmar
                accion={() => eliminarCotizacion(quoteId)}
                titulo={`¿Eliminar ${codigo}?`}
                mensaje="Se borran la cotización, todas sus versiones y líneas, y su enlace público deja de funcionar. No se puede deshacer."
                textoConfirmar="Eliminar cotización"
                peligro
                className={`${clases.botonPeligro} shrink-0 px-3 py-2`}
              >
                <IconoAccion accion="basura" /> Eliminar
              </BotonConfirmar>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
