"use client";

import { useRef, useState, useTransition } from "react";
import { clases } from "./ui";

/**
 * Botón que pide confirmación en una ventana antes de ejecutar una acción del servidor.
 * La acción devuelve un mensaje de error, o nada si salió bien.
 */
export function BotonConfirmar({
  accion,
  titulo,
  mensaje,
  textoConfirmar,
  peligro = false,
  className,
  children,
}: {
  accion: () => Promise<string | void>;
  titulo: string;
  mensaje: string;
  textoConfirmar: string;
  peligro?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function confirmar() {
    setError(null);
    iniciar(async () => {
      const r = await accion();
      if (r) setError(r);
      else dialogo.current?.close();
    });
  }

  return (
    <>
      <button type="button" onClick={() => dialogo.current?.showModal()} className={className}>
        {children}
      </button>
      <dialog
        ref={dialogo}
        onClose={() => setError(null)}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-borde bg-superficie p-0 text-texto shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-titulo">{titulo}</h2>
          <p className="mt-2 text-sm text-texto-suave">{mensaje}</p>
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => dialogo.current?.close()} className={clases.botonSecundario} disabled={pendiente}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={pendiente}
              className={peligro ? clases.botonPeligroSolido : clases.botonPrimario}
            >
              {pendiente ? "Procesando…" : textoConfirmar}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
