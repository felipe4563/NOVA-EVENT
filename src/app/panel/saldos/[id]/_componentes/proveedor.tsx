"use client";

import { useId, useState, useTransition } from "react";
import { BotonConfirmar } from "@/components/boton-confirmar";
import { clases } from "@/components/ui";
import { deCentavos, formatoBs } from "@/lib/cotizacion/dinero";
import { cambiarMontoProveedor, cambiarQuienPaga } from "../actions";

/** Cambia quién paga la línea. Cambia el total a cobrar a la pareja, así que pide confirmación. */
export function QuienPaga({ itemId, paga, proveedor, total }: { itemId: string; paga: "nova" | "client"; proveedor: string; total: number }) {
  const aPareja = paga === "nova";
  return (
    <BotonConfirmar
      accion={() => cambiarQuienPaga(itemId, aPareja ? "client" : "nova")}
      titulo={aPareja ? "¿Lo paga la pareja directo?" : "¿Lo paga Nova Event?"}
      mensaje={
        aPareja
          ? `${proveedor} sale del total a cobrar (−${formatoBs(total)}) y se borra su plan de pagos. La última cuota pendiente de la pareja absorbe la diferencia.`
          : `${proveedor} vuelve al total a cobrar (+${formatoBs(total)}) y, si está confirmado, se arma su plan de pagos. La última cuota pendiente de la pareja absorbe la diferencia.`
      }
      textoConfirmar={aPareja ? "Lo paga la pareja" : "Lo paga Nova Event"}
      className={`${clases.botonSecundario} px-3 py-2`}
    >
      {aPareja ? "Lo paga la pareja directo" : "Lo paga Nova Event"}
    </BotonConfirmar>
  );
}

/** Monto a pagar al proveedor en este evento (la pareja no lo ve). */
export function MontoProveedor({ itemId, aPagar, pagado }: { itemId: string; aPagar: number; pagado: number }) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState(deCentavos(aPagar));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const id = useId();

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="text-sm font-medium text-enlace hover:text-titulo">
        Cambiar monto a pagar
      </button>
    );

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await cambiarMontoProveedor(itemId, monto);
      if (r) setError(r);
      else setAbierto(false);
    });
  }

  return (
    <form onSubmit={guardar} noValidate className="w-full space-y-2">
      <label htmlFor={id} className={clases.etiqueta}>
        Monto a pagar (Bs)
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          inputMode="decimal"
          aria-invalid={Boolean(error) || undefined}
          className={`${clases.campo} w-40 tabular-nums`}
        />
        <button type="submit" disabled={pendiente} className={`${clases.botonPrimario} px-3 py-2`}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" disabled={pendiente} onClick={() => setAbierto(false)} className={`${clases.botonSecundario} px-3 py-2`}>
          Cancelar
        </button>
      </div>
      <p className={error ? clases.error : clases.ayuda} role={error ? "alert" : undefined}>
        {error ?? `No puede quedar por debajo de lo ya pagado (${formatoBs(pagado)}). La última cuota pendiente absorbe la diferencia.`}
      </p>
    </form>
  );
}
