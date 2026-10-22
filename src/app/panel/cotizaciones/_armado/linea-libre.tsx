"use client";

import { useActionState, useId, useState } from "react";
import { IconoAccion } from "@/components/iconos";
import { Aviso, clases } from "@/components/ui";
import { agregarLinea, type EstadoArmado } from "../actions";

/** Línea libre, sin proveedor ni categoría (ej. "Recuerdos para invitados"). */
export function LineaLibre({ versionId }: { versionId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, pendiente] = useActionState(async (prev: EstadoArmado, fd: FormData) => {
    const r = await agregarLinea(versionId, prev, fd);
    if (r?.ok) setAbierto(false);
    return r;
  }, undefined);
  const id = useId();
  const e = estado?.errores ?? {};
  // Tras agregar se limpia; si hubo error se vuelve a poner lo escrito.
  const v = estado?.ok ? {} : (estado?.valores ?? {});

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-enlace hover:text-titulo">
        <IconoAccion accion="mas" /> Agregar línea libre
      </button>
    );
  }
  return (
    <form action={enviar} noValidate key={JSON.stringify(estado ?? null)} className="rounded-xl bg-superficie-2/60 p-3">
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <input type="hidden" name="categoria" value="" />
      <input type="hidden" name="proveedor" value="" />
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem] sm:items-start">
        <div>
          <label htmlFor={`${id}-etiqueta`} className={clases.etiqueta}>
            Qué es
          </label>
          <input
            id={`${id}-etiqueta`}
            name="etiqueta"
            defaultValue={v.etiqueta ?? ""}
            required
            maxLength={120}
            autoComplete="off"
            autoFocus
            placeholder="Ej. Recuerdos para invitados"
            aria-invalid={Boolean(e.etiqueta) || undefined}
            aria-describedby={`${id}-etiqueta-ayuda`}
            className={`${clases.campo} mt-1.5`}
          />
          {e.etiqueta ? (
            <p id={`${id}-etiqueta-ayuda`} className={clases.error}>
              {e.etiqueta}
            </p>
          ) : (
            <p id={`${id}-etiqueta-ayuda`} className={clases.ayuda}>
              Lo verá el cliente en la propuesta
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${id}-precio`} className={clases.etiqueta}>
            Monto (Bs)
          </label>
          <input
            id={`${id}-precio`}
            name="precio"
            defaultValue={v.precio ?? ""}
            required
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={Boolean(e.precio) || undefined}
            className={`${clases.campo} mt-1.5`}
          />
          {e.precio ? <p className={clases.error}>{e.precio}</p> : <p className={clases.ayuda}>Ej. 2.500 o 85,50</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => setAbierto(false)} className={`${clases.botonSecundario} py-2`}>
          Cancelar
        </button>
        <button type="submit" disabled={pendiente} className={`${clases.botonPrimario} py-2`}>
          {pendiente ? "Agregando…" : "Agregar"}
        </button>
      </div>
    </form>
  );
}
