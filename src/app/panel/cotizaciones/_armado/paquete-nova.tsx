"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { Insignia, clases } from "@/components/ui";
import { deCentavos, formatoBs } from "@/lib/cotizacion/dinero";
import { ajustarPrecioNova, elegirPaqueteNova } from "../actions";

export type OpcionNova = { id: string; name: string; priceCents: number; active: boolean };

/** Paquete de Nova Event de la versión: selector y precio ajustable (descuento). */
export function PaqueteNova({
  versionId,
  paquetes,
  actualId,
  precioAjustado,
  editable,
}: {
  versionId: string;
  paquetes: OpcionNova[];
  actualId: string | null;
  precioAjustado: number | null;
  editable: boolean;
}) {
  const actual = paquetes.find((p) => p.id === actualId) ?? null;
  // Los inactivos solo aparecen si esta versión ya los usa.
  const lista = paquetes.filter((p) => p.active || p.id === actualId);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const id = useId();

  function elegir(valor: string) {
    setError(null);
    setEditando(false);
    iniciar(async () => {
      const r = await elegirPaqueteNova(versionId, valor || null);
      if (r) setError(r);
    });
  }

  return (
    <section className={`${clases.tarjeta} p-4 sm:p-5`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-base text-titulo">Paquete Nova Event</h2>
          {!editable && <p className="mt-0.5 text-sm text-texto">{actual ? actual.name : "Sin paquete Nova"}</p>}
        </div>
        {editable && (
          <label className="block sm:w-64">
            <span className="sr-only">Paquete Nova Event</span>
            <select key={`${actualId}-${error}`} defaultValue={actualId ?? ""} disabled={pendiente} onChange={(e) => elegir(e.target.value)} className={clases.campo}>
              <option value="">Sin paquete Nova</option>
              {lista.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatoBs(p.priceCents)}
                  {p.active ? "" : " (inactivo)"}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {actual && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-borde pt-3">
          <p className="text-sm text-texto">
            <span className="font-semibold tabular-nums">{formatoBs(precioAjustado ?? actual.priceCents)}</span>
            {precioAjustado !== null && <span className="ml-2 text-texto-suave line-through tabular-nums">{formatoBs(actual.priceCents)}</span>}
          </p>
          {precioAjustado !== null && <Insignia tono="oro">Precio ajustado</Insignia>}
          {editable && (
            <button type="button" onClick={() => setEditando((v) => !v)} className="text-sm font-medium text-enlace hover:text-titulo">
              {editando ? "Cerrar" : "Ajustar precio"}
            </button>
          )}
        </div>
      )}
      {editable && actual && editando && (
        <AjustePrecio key={String(precioAjustado)} versionId={versionId} id={id} inicial={precioAjustado ?? actual.priceCents} ajustado={precioAjustado !== null} alGuardar={() => setEditando(false)} />
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
    </section>
  );
}

function AjustePrecio({ versionId, id, inicial, ajustado, alGuardar }: { versionId: string; id: string; inicial: number; ajustado: boolean; alGuardar: () => void }) {
  const [estado, enviar, guardando] = useActionState(async (prev: Awaited<ReturnType<typeof ajustarPrecioNova>>, fd: FormData) => {
    const r = await ajustarPrecioNova(versionId, prev, fd);
    if (r?.ok) alGuardar();
    return r;
  }, undefined);
  const error = estado?.errores?.precio ?? estado?.error;
  return (
    <form action={enviar} noValidate key={JSON.stringify(estado ?? null)} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="sm:w-48">
        <label htmlFor={`${id}-precio`} className="sr-only">
          Precio del paquete Nova (Bs)
        </label>
        <input
          id={`${id}-precio`}
          name="precio"
          defaultValue={estado?.valores?.precio ?? deCentavos(inicial)}
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={Boolean(error) || undefined}
          className={clases.campo}
        />
        {error ? <p className={clases.error}>{error}</p> : <p className={clases.ayuda}>Ej. 2.500 o 85,50</p>}
      </div>
      <button type="submit" disabled={guardando} className={`${clases.botonPrimario} py-2.5`}>
        Guardar
      </button>
      {ajustado && (
        <button type="submit" name="restablecer" value="1" disabled={guardando} className={`${clases.botonSecundario} py-2.5`}>
          Usar precio del paquete
        </button>
      )}
    </form>
  );
}
