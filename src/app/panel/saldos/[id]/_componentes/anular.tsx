"use client";

import { useId, useState, useTransition } from "react";
import { clases } from "@/components/ui";
import { anularAjuste, anularMovimiento } from "../actions";
import { Ventana } from "./ventana";

/** «Anular» con motivo obligatorio. Lo anulado queda visible y tachado; nunca se borra. */
export function Anular({ id, que, descripcion }: { id: string; que: "movimiento" | "ajuste"; descripcion: string }) {
  return (
    <Ventana
      boton={
        <>
          Anular<span className="sr-only"> {descripcion}</span>
        </>
      }
      claseBoton="rounded-md px-2 py-1 text-xs font-medium text-error hover:bg-error/10"
      titulo={que === "ajuste" ? "Anular ajuste" : "Anular movimiento"}
      descripcion={
        <>
          <span className="font-medium text-texto">{descripcion}</span>. Queda visible y tachado, y deja de contar.
          {que === "ajuste" && " La última cuota pendiente absorbe la diferencia."}
        </>
      }
    >
      {(listo) => <Formulario id={id} que={que} listo={listo} />}
    </Ventana>
  );
}

function Formulario({ id, que, listo }: { id: string; que: "movimiento" | "ajuste"; listo: (mensaje?: string) => void }) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const campo = useId();

  function anular(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await (que === "ajuste" ? anularAjuste : anularMovimiento)(id, motivo);
      if (r) setError(r);
      else {
        setMotivo("");
        listo("Anulado.");
      }
    });
  }

  return (
    <form onSubmit={anular} noValidate className="space-y-4">
      <div>
        <label htmlFor={campo} className={clases.etiqueta}>
          Motivo
        </label>
        <textarea
          id={campo}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          maxLength={200}
          required
          placeholder="Se registró dos veces"
          className={`${clases.campo} mt-1.5 resize-y`}
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={pendiente} className={clases.botonPeligroSolido}>
          {pendiente ? "Anulando…" : "Anular"}
        </button>
      </div>
    </form>
  );
}
