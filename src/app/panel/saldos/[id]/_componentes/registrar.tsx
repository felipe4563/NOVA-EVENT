"use client";

import { useActionState, useId, useState } from "react";
import { IconoAccion } from "@/components/iconos";
import { Aviso, Campo, clases } from "@/components/ui";
import { deCentavos, formatoBs } from "@/lib/cotizacion/dinero";
import { ETIQUETA_FORMA, FORMAS_PAGO } from "@/lib/saldos/recibo";
import { type EstadoMovimiento, registrarCobro, registrarDevolucion, registrarDevolucionProveedor, registrarPagoProveedor } from "../actions";
import { Ventana } from "./ventana";

export type TipoMovimiento = "cobro" | "devolucion" | "pago_proveedor" | "devolucion_proveedor";

const ACCIONES = {
  cobro: registrarCobro,
  devolucion: registrarDevolucion,
  pago_proveedor: registrarPagoProveedor,
  devolucion_proveedor: registrarDevolucionProveedor,
} as const;

const TEXTOS: Record<TipoMovimiento, { titulo: string; enviar: string; quien: string; limite: string }> = {
  cobro: { titulo: "Registrar cobro", enviar: "Registrar cobro", quien: "Lo recibes tú", limite: "Falta cobrar" },
  devolucion: { titulo: "Devolución a la pareja", enviar: "Registrar devolución", quien: "La haces tú", limite: "Cobrado a la fecha" },
  pago_proveedor: { titulo: "Registrar pago", enviar: "Registrar pago", quien: "Lo pagas tú", limite: "Falta pagar" },
  devolucion_proveedor: { titulo: "Devolución del proveedor", enviar: "Registrar devolución", quien: "La recibes tú", limite: "Pagado a la fecha" },
};

/**
 * Un solo formulario para los cuatro movimientos de dinero.
 * `refId` es la cotización (cobro y devolución a la pareja) o la línea del proveedor.
 */
export function Registrar({
  tipo,
  refId,
  hoy,
  limite,
  sugerido,
  maxBytes,
  quien,
  boton,
  claseBoton,
}: {
  tipo: TipoMovimiento;
  refId: string;
  hoy: string;
  /** Lo máximo que se puede registrar (falta cobrar, cobrado…), para mostrarlo. */
  limite: number;
  /** Monto con el que se llena el campo (p. ej. lo que falta de la próxima cuota). */
  sugerido?: number;
  maxBytes: number;
  /** Proveedor, en sus movimientos. */
  quien?: string;
  boton: React.ReactNode;
  claseBoton: string;
}) {
  const t = TEXTOS[tipo];
  return (
    <Ventana
      boton={boton}
      claseBoton={claseBoton}
      titulo={t.titulo}
      descripcion={
        <>
          {quien && <span className="font-medium text-texto">{quien} · </span>}
          {t.limite}: <span className="font-medium text-texto tabular-nums">{formatoBs(limite)}</span>
        </>
      }
    >
      {(listo) => <Formulario tipo={tipo} refId={refId} hoy={hoy} sugerido={sugerido} maxBytes={maxBytes} listo={listo} />}
    </Ventana>
  );
}

function Formulario({
  tipo,
  refId,
  hoy,
  sugerido,
  maxBytes,
  listo,
}: {
  tipo: TipoMovimiento;
  refId: string;
  hoy: string;
  sugerido?: number;
  maxBytes: number;
  listo: (mensaje?: string) => void;
}) {
  const [estado, enviar, pendiente] = useActionState(async (prev: EstadoMovimiento, fd: FormData) => {
    const r = await ACCIONES[tipo](refId, prev, fd);
    if (r?.ok) listo(r.ok);
    return r;
  }, undefined);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const id = useId();
  const t = TEXTOS[tipo];
  const e = { ...estado?.errores, ...(errorArchivo ? { comprobante: errorArchivo } : {}) };
  const v = { monto: sugerido ? deCentavos(sugerido) : "", fecha: hoy, forma: "", referencia: "", nota: "", ...estado?.valores };
  const mb = Math.round(maxBytes / 1024 / 1024);

  return (
    <form action={enviar} noValidate className="space-y-4" key={JSON.stringify(estado ?? null)}>
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-2">
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
        <Campo id={`${id}-fecha`} etiqueta="Fecha" error={e.fecha}>
          <input id={`${id}-fecha`} name="fecha" type="date" max={hoy} defaultValue={v.fecha} aria-invalid={Boolean(e.fecha) || undefined} className={clases.campo} />
        </Campo>
        <Campo id={`${id}-forma`} etiqueta="Forma de pago" error={e.forma}>
          <select id={`${id}-forma`} name="forma" defaultValue={v.forma} aria-invalid={Boolean(e.forma) || undefined} className={clases.campo}>
            <option value="" disabled>
              Elige…
            </option>
            {FORMAS_PAGO.map((f) => (
              <option key={f} value={f}>
                {ETIQUETA_FORMA[f]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id={`${id}-referencia`} etiqueta="Referencia (opcional)" error={e.referencia}>
          <input
            id={`${id}-referencia`}
            name="referencia"
            maxLength={80}
            placeholder="N.º de operación"
            defaultValue={v.referencia}
            aria-invalid={Boolean(e.referencia) || undefined}
            className={clases.campo}
          />
        </Campo>
      </div>
      <Campo
        id={`${id}-comprobante`}
        etiqueta="Comprobante (opcional)"
        error={e.comprobante}
        ayuda={estado?.archivo ? `Vuelve a elegir «${estado.archivo}».` : `Foto o PDF de hasta ${mb} MB.`}
      >
        <input
          id={`${id}-comprobante`}
          name="comprobante"
          type="file"
          accept="image/*,application/pdf"
          aria-invalid={Boolean(e.comprobante) || undefined}
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            if (f && f.size > maxBytes) {
              setErrorArchivo(`El comprobante pesa más de ${mb} MB.`);
              ev.target.value = "";
            } else setErrorArchivo(null);
          }}
          className="block w-full text-sm text-texto-suave file:mr-3 file:rounded-lg file:border file:border-borde-campo file:bg-superficie file:px-3 file:py-2 file:text-sm file:font-medium file:text-texto hover:file:bg-superficie-2"
        />
      </Campo>
      <Campo id={`${id}-nota`} etiqueta="Nota interna (opcional)" error={e.nota}>
        <textarea id={`${id}-nota`} name="nota" rows={2} maxLength={300} defaultValue={v.nota} aria-invalid={Boolean(e.nota) || undefined} className={`${clases.campo} resize-y`} />
      </Campo>
      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-texto-suave">{t.quien}.</p>
        <button type="submit" disabled={pendiente} className={clases.botonPrimario}>
          {pendiente ? (
            "Guardando…"
          ) : (
            <>
              <IconoAccion accion="check" /> {t.enviar}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
