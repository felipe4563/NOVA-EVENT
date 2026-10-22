"use client";

import { useState, useTransition } from "react";
import { Insignia, clases } from "@/components/ui";
import { type Confirmacion, resumenConfirmaciones } from "@/lib/cotizacion/aceptacion";
import { formatoBs } from "@/lib/cotizacion/dinero";
import { confirmarLinea, desconfirmarLinea, marcarNoDisponible } from "../estado-actions";

export type LineaConfirmacion = {
  id: string;
  /** Nombre congelado al aceptar. */
  proveedor: string | null;
  etiqueta: string;
  total: number;
  confirmation: Confirmacion;
  /** El proveedor se borró después de aceptar: ya no se puede reservar su día. */
  proveedorBorrado: boolean;
  /** Confirmado, pero su día ocupado se quitó del calendario (o está en otra fecha). */
  reservaQuitada: boolean;
};

const ESTADO: Record<Confirmacion, { texto: string; tono: "oro" | "agua" | "error" }> = {
  pending: { texto: "Por confirmar", tono: "oro" },
  confirmed: { texto: "Confirmado", tono: "agua" },
  unavailable: { texto: "No disponible", tono: "error" },
};

/** Lista de proveedores de la versión aceptada con su confirmación («3 de 7 confirmados»). */
export function Confirmaciones({ lineas, editable, dia }: { lineas: LineaConfirmacion[]; editable: boolean; dia: string }) {
  const r = resumenConfirmaciones(lineas);
  return (
    <section aria-labelledby="confirmacion-titulo" className={`${clases.tarjeta} p-4 sm:px-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="confirmacion-titulo" className="font-display text-lg text-titulo">
          Confirmación de proveedores
        </h2>
        <p className="text-sm font-medium text-texto tabular-nums">
          {r.confirmados} de {r.total} {r.total === 1 ? "confirmado" : "confirmados"}
          {r.noDisponibles > 0 && <span className="text-error"> · {r.noDisponibles} no {r.noDisponibles === 1 ? "disponible" : "disponibles"}</span>}
        </p>
      </div>
      {r.total > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-superficie-2" aria-hidden>
          <div className="h-full rounded-full bg-agua-500 transition-all" style={{ width: `${(r.confirmados / r.total) * 100}%` }} />
        </div>
      )}
      <p className="mt-2 text-sm text-texto-suave">
        Al confirmar a un proveedor se registra su día ocupado ({dia}) en su calendario, como «Registrado por Nova Event».
        {r.noDisponibles > 0 && " Para reemplazar a uno no disponible, reabre la cotización."}
      </p>
      {lineas.length ? (
        <ul className="mt-3 divide-y divide-borde">
          {lineas.map((l) => (
            <Fila key={l.id} l={l} editable={editable} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-texto-suave">Esta versión no tiene proveedores que confirmar.</p>
      )}
    </section>
  );
}

function Fila({ l, editable }: { l: LineaConfirmacion; editable: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ejecutar = (accion: () => Promise<string | void>) => {
    setError(null);
    iniciar(async () => {
      const r = await accion();
      if (r) setError(r);
    });
  };
  const e = ESTADO[l.confirmation];
  const nombre = l.proveedor ?? l.etiqueta;

  return (
    <li className="py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="font-medium break-words text-texto">{nombre}</p>
          <p className="text-sm break-words text-texto-suave">
            {l.proveedor ? `${l.etiqueta} · ` : ""}
            <span className="tabular-nums">{formatoBs(l.total)}</span>
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Insignia tono={e.tono}>{e.texto}</Insignia>
            {l.proveedorBorrado && <Insignia>Proveedor eliminado</Insignia>}
            {l.reservaQuitada && <Insignia tono="error">Reserva quitada del calendario</Insignia>}
          </div>
          {l.reservaQuitada && editable && <p className="mt-1 text-xs text-texto-suave">Usa «Deshacer» y luego «Confirmar» para volver a reservar su día.</p>}
        </div>
        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            {l.confirmation === "pending" ? (
              <>
                {!l.proveedorBorrado && (
                  <button type="button" disabled={pendiente} onClick={() => ejecutar(() => confirmarLinea(l.id))} className={`${clases.botonPrimario} px-3 py-2`}>
                    Confirmar
                  </button>
                )}
                <button type="button" disabled={pendiente} onClick={() => ejecutar(() => marcarNoDisponible(l.id))} className={`${clases.botonSecundario} px-3 py-2`}>
                  No disponible
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={pendiente}
                onClick={() => ejecutar(() => desconfirmarLinea(l.id))}
                className={`${clases.botonSecundario} px-3 py-2`}
                title={l.confirmation === "confirmed" ? "Vuelve a «Por confirmar» y libera su día ocupado" : "Vuelve a «Por confirmar»"}
              >
                Deshacer
                <span className="sr-only"> ({nombre})</span>
              </button>
            )}
            {pendiente && <span className="text-sm text-texto-suave">Guardando…</span>}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
    </li>
  );
}
