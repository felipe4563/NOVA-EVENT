"use client";

import { useActionState, useId } from "react";
import { IconoAccion } from "@/components/iconos";
import { Aviso, Campo, clases } from "@/components/ui";
import { type EstadoAjuste, agregarAjuste } from "../actions";
import { Ventana } from "./ventana";

/** Cargo o descuento sobre el total del evento (recargo por cambio de fecha, extra acordado, descuento…). */
export function AgregarAjuste({ quoteId }: { quoteId: string }) {
  return (
    <Ventana
      boton={
        <>
          <IconoAccion accion="mas" /> Agregar ajuste
        </>
      }
      claseBoton={`${clases.botonSecundario} px-3 py-2`}
      titulo="Agregar ajuste"
      descripcion="Suma o resta al total. La última cuota pendiente de la pareja absorbe la diferencia."
    >
      {(listo) => <Formulario quoteId={quoteId} listo={listo} />}
    </Ventana>
  );
}

function Formulario({ quoteId, listo }: { quoteId: string; listo: (mensaje?: string) => void }) {
  const [estado, enviar, pendiente] = useActionState(async (prev: EstadoAjuste, fd: FormData) => {
    const r = await agregarAjuste(quoteId, prev, fd);
    if (r?.ok) listo(r.ok);
    return r;
  }, undefined);
  const id = useId();
  const e = estado?.errores ?? {};
  const v = { tipo: "cargo", concepto: "", monto: "", ...estado?.valores };

  return (
    <form action={enviar} noValidate className="space-y-4" key={JSON.stringify(estado ?? null)}>
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <fieldset>
        <legend className={clases.etiqueta}>Tipo</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(
            [
              ["cargo", "Cargo", "Suma al total"],
              ["descuento", "Descuento", "Resta al total"],
            ] as const
          ).map(([valor, texto, ayuda]) => (
            <label
              key={valor}
              className="flex cursor-pointer flex-col rounded-lg border border-borde-campo px-3 py-2 has-checked:border-primario has-checked:bg-activo"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-texto">
                <input type="radio" name="tipo" value={valor} defaultChecked={v.tipo === valor} className="accent-primario" />
                {texto}
              </span>
              <span className="text-xs text-texto-suave">{ayuda}</span>
            </label>
          ))}
        </div>
        {e.tipo && <p className={clases.error}>{e.tipo}</p>}
      </fieldset>
      <Campo id={`${id}-concepto`} etiqueta="Concepto" error={e.concepto}>
        <input
          id={`${id}-concepto`}
          name="concepto"
          maxLength={120}
          placeholder="Recargo por cambio de fecha"
          defaultValue={v.concepto}
          aria-invalid={Boolean(e.concepto) || undefined}
          className={clases.campo}
        />
      </Campo>
      <Campo id={`${id}-monto`} etiqueta="Monto (Bs)" error={e.monto}>
        <input
          id={`${id}-monto`}
          name="monto"
          inputMode="decimal"
          placeholder="1.500,50"
          defaultValue={v.monto}
          aria-invalid={Boolean(e.monto) || undefined}
          className={`${clases.campo} tabular-nums`}
        />
      </Campo>
      <div className="flex justify-end">
        <button type="submit" disabled={pendiente} className={clases.botonPrimario}>
          {pendiente ? "Guardando…" : "Agregar ajuste"}
        </button>
      </div>
    </form>
  );
}
