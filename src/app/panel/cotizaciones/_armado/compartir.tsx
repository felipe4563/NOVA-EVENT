"use client";

import { useRef, useState, useTransition } from "react";
import { BotonConfirmar } from "@/components/boton-confirmar";
import { IconoAccion } from "@/components/iconos";
import { clases } from "@/components/ui";
import { activarEnlace, desactivarEnlace, regenerarEnlace } from "../estado-actions";

/** Copiar al portapapeles; si el navegador no deja, selecciona el texto para copiarlo a mano. */
function BotonCopiar({ enlace, campo }: { enlace: string; campo: React.RefObject<HTMLInputElement | null> }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      campo.current?.focus();
      campo.current?.select();
    }
  }
  return (
    <button type="button" onClick={copiar} className={`${clases.botonPrimario} px-3 py-2`}>
      <IconoAccion accion={copiado ? "check" : "copiar"} /> {copiado ? "Copiado" : "Copiar enlace"}
    </button>
  );
}

/**
 * Panel «Compartir» de la cotización. `enlace` es la dirección completa si el enlace está activo.
 * Sin permiso de editar solo se puede copiar un enlace ya activo.
 */
export function Compartir({ quoteId, enlace, editable, borrador }: { quoteId: string; enlace: string | null; editable: boolean; borrador: boolean }) {
  const campo = useRef<HTMLInputElement>(null);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ejecutar = (accion: () => Promise<string | void>) => {
    setError(null);
    iniciar(async () => {
      const r = await accion();
      if (r) setError(r);
    });
  };

  if (!editable && !enlace) return null;
  return (
    <section aria-labelledby="compartir-titulo" className={`${clases.tarjeta} space-y-3 p-4 sm:px-6`}>
      <div>
        <h2 id="compartir-titulo" className="font-display text-lg text-titulo">
          Compartir con el cliente
        </h2>
        <p className="text-sm text-texto-suave">
          {enlace
            ? "Cualquiera con este enlace ve la propuesta en su celular, sin cuenta. Siempre muestra el estado actual."
            : `Crea un enlace para que los novios vean la propuesta en su celular, sin cuenta.${borrador ? " La cotización pasará a «Enviada»." : ""}`}
        </p>
      </div>

      {enlace ? (
        <>
          <input
            ref={campo}
            readOnly
            value={enlace}
            aria-label="Enlace público de la propuesta"
            onFocus={(e) => e.currentTarget.select()}
            className={`${clases.campo} font-mono text-xs sm:text-xs`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <BotonCopiar enlace={enlace} campo={campo} />
            {editable && (
              <>
                <a href={enlace} target="_blank" rel="noopener noreferrer" className={`${clases.botonSecundario} px-3 py-2`}>
                  <IconoAccion accion="enlace" /> Abrir
                </a>
                <button type="button" disabled={pendiente} onClick={() => ejecutar(() => desactivarEnlace(quoteId))} className={`${clases.botonSecundario} px-3 py-2`}>
                  Desactivar
                </button>
                <BotonConfirmar
                  accion={() => regenerarEnlace(quoteId)}
                  titulo="¿Regenerar el enlace?"
                  mensaje="El enlace anterior dejará de funcionar. Tendrás que enviar el nuevo a los clientes."
                  textoConfirmar="Regenerar enlace"
                  peligro
                  className={`${clases.botonPeligro} px-3 py-2`}
                >
                  Regenerar
                </BotonConfirmar>
              </>
            )}
            {pendiente && <span className="text-sm text-texto-suave">Guardando…</span>}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pendiente} onClick={() => ejecutar(() => activarEnlace(quoteId))} className={`${clases.botonPrimario} px-3 py-2`}>
            <IconoAccion accion="enlace" /> {pendiente ? "Activando…" : "Activar enlace"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
    </section>
  );
}
