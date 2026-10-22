"use client";

import { useState, useTransition } from "react";
import { mostrarPagos } from "../../evento-actions";

/** Interruptor «Mostrar pagos en el enlace»: la pareja ve «Mis pagos» y sus recibos solo si está activo. */
export function MostrarPagos({ quoteId, activo }: { quoteId: string; activo: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function cambiar(e: React.ChangeEvent<HTMLInputElement>) {
    const valor = e.target.checked;
    setError(null);
    iniciar(async () => {
      const r = await mostrarPagos(quoteId, valor);
      if (r) setError(r);
    });
  }

  return (
    <div className="text-sm">
      <label className="inline-flex cursor-pointer items-center gap-2 text-texto">
        <input type="checkbox" role="switch" checked={activo} onChange={cambiar} disabled={pendiente} className="size-4 accent-vino-600" />
        Mostrar pagos en el enlace
      </label>
      {error && (
        <p role="alert" className="mt-1 text-error">
          {error}
        </p>
      )}
    </div>
  );
}
