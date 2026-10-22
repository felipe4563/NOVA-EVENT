"use client";

import { useEffect, useRef, useState } from "react";
import { IconoCerrar } from "@/components/iconos";

/**
 * Botón que abre un formulario en una ventana (como BotonConfirmar, pero con campos).
 * El contenido recibe `listo(mensaje)`: cierra la ventana y deja el mensaje junto al botón.
 */
export function Ventana({
  boton,
  claseBoton,
  titulo,
  descripcion,
  ancho = "w-[min(30rem,calc(100vw-2rem))]",
  children,
}: {
  boton: React.ReactNode;
  claseBoton: string;
  titulo: string;
  descripcion?: React.ReactNode;
  /** Clase de ancho de la ventana (por defecto, la de un formulario corto). */
  ancho?: string;
  children: (listo: (mensaje?: string) => void) => React.ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [abierta, setAbierta] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const listo = (mensaje?: string) => {
    setAbierta(false);
    setAviso(mensaje ?? null);
  };

  // La ventana nativa se abre y cierra según el estado (así `listo` no toca el ref durante el render).
  useEffect(() => {
    const d = dialogo.current;
    if (abierta && !d?.open) d?.showModal();
    if (!abierta && d?.open) d.close();
  }, [abierta]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAviso(null);
          setAbierta(true);
        }}
        className={claseBoton}
      >
        {boton}
      </button>
      {aviso && (
        <span role="status" className="self-center text-sm text-agua-700 dark:text-agua-300">
          {aviso}
        </span>
      )}
      <dialog
        ref={dialogo}
        onClose={() => setAbierta(false)}
        className={`m-auto max-h-[calc(100dvh-2rem)] ${ancho} rounded-2xl border border-borde bg-superficie p-0 text-left text-texto shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]`}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-titulo">{titulo}</h2>
            <button type="button" onClick={() => setAbierta(false)} aria-label="Cerrar" className="-m-1 rounded-lg p-1 text-texto-suave hover:text-titulo">
              <IconoCerrar />
            </button>
          </div>
          {descripcion && <div className="mt-1 text-sm text-texto-suave">{descripcion}</div>}
          <div className="mt-4">{children(listo)}</div>
        </div>
      </dialog>
    </>
  );
}
