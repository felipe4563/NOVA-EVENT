"use client";

import { useActionState, useId, useState } from "react";
import { BotonConfirmar } from "@/components/boton-confirmar";
import { IconoAccion } from "@/components/iconos";
import { Insignia, clases } from "@/components/ui";
import { totalLinea } from "@/lib/cotizacion/calculo";
import { deCentavos, formatoBs } from "@/lib/cotizacion/dinero";
import { textoDisponibilidad } from "@/lib/cotizacion/disponibilidad";
import { ajustarPrecioLinea, quitarLinea } from "../actions";

export type LineaVista = {
  id: string;
  /** Nombre del proveedor; null en líneas libres o si el proveedor se borró. */
  proveedor: string | null;
  proveedorInactivo: boolean;
  etiqueta: string;
  pricing: "fixed" | "per_person";
  unitCents: number;
  totalCents: number;
  manualPrice: boolean;
  /** Salió de un paquete del proveedor (tiene precio de lista). */
  tienePaquete: boolean;
  /** Su paquete sigue existiendo y activo: se puede volver a su precio actual. */
  paqueteVigente: boolean;
  /** Estado del proveedor para la fecha del evento (null sin proveedor). */
  disponibilidad: "libre" | "parcial" | "ocupado" | null;
  /** Horarios ocupados ese día ("10:00–14:00"). */
  rangos: string[];
  capacidad: number | null;
};

/** Una línea elegida: proveedor, paquete, precio y avisos. */
export function Linea({ l, invitados, editable }: { l: LineaVista; invitados: number; editable: boolean }) {
  const [editando, setEditando] = useState(false);
  const porPersona = `${formatoBs(l.unitCents)} × ${invitados} ${invitados === 1 ? "invitado" : "invitados"}`;
  const sinCapacidad = l.capacidad !== null && invitados > l.capacidad;

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium break-words text-texto">{l.proveedor ?? l.etiqueta}</p>
          {l.proveedor && <p className="text-sm break-words text-texto-suave">{l.etiqueta}</p>}
          {l.pricing === "per_person" && <p className="text-xs text-texto-suave tabular-nums">{l.manualPrice ? `Paquete: ${porPersona} = ${formatoBs(totalLinea("per_person", l.unitCents, invitados))}` : porPersona}</p>}
          {l.pricing === "fixed" && l.manualPrice && <p className="text-xs text-texto-suave tabular-nums">Paquete: {formatoBs(l.unitCents)}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5 empty:hidden">
            {l.manualPrice && <Insignia tono="oro">Precio ajustado</Insignia>}
            {l.disponibilidad === "ocupado" && <Insignia tono="error">{textoDisponibilidad("ocupado", l.rangos)}</Insignia>}
            {l.disponibilidad === "parcial" && <Insignia tono="oro">{textoDisponibilidad("parcial", l.rangos)}</Insignia>}
            {sinCapacidad && (
              <Insignia tono="error">
                Capacidad {l.capacidad}, invitados {invitados}
              </Insignia>
            )}
            {l.proveedorInactivo && <Insignia>Proveedor inactivo</Insignia>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="font-semibold text-texto tabular-nums">{formatoBs(l.totalCents)}</p>
          {editable && (
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setEditando((v) => !v)}
                aria-expanded={editando}
                className="rounded-md p-1.5 text-texto-suave transition hover:bg-superficie-2 hover:text-texto"
                title="Cambiar precio"
              >
                <IconoAccion accion="editar" className="size-4" />
                <span className="sr-only">Cambiar precio de {l.proveedor ?? l.etiqueta}</span>
              </button>
              <BotonConfirmar
                accion={() => quitarLinea(l.id)}
                titulo="¿Quitar esta línea?"
                mensaje={`«${l.proveedor ? `${l.proveedor} — ${l.etiqueta}` : l.etiqueta}» sale de esta versión.`}
                textoConfirmar="Quitar"
                peligro
                className="rounded-md p-1.5 text-texto-suave transition hover:bg-error/10 hover:text-error"
              >
                <IconoAccion accion="basura" className="size-4" />
                <span className="sr-only">Quitar {l.proveedor ?? l.etiqueta}</span>
              </BotonConfirmar>
            </div>
          )}
        </div>
      </div>
      {editable && editando && <PrecioLinea key={`${l.totalCents}-${l.manualPrice}`} l={l} alGuardar={() => setEditando(false)} />}
    </li>
  );
}

function PrecioLinea({ l, alGuardar }: { l: LineaVista; alGuardar: () => void }) {
  const [estado, enviar, guardando] = useActionState(async (prev: Awaited<ReturnType<typeof ajustarPrecioLinea>>, fd: FormData) => {
    const r = await ajustarPrecioLinea(l.id, prev, fd);
    if (r?.ok) alGuardar();
    return r;
  }, undefined);
  const id = useId();
  const error = estado?.errores?.precio ?? estado?.error;
  const conLista = l.tienePaquete || l.pricing === "per_person" || l.manualPrice;
  return (
    <form action={enviar} noValidate key={JSON.stringify(estado ?? null)} className="mt-3 rounded-xl bg-superficie-2/60 p-3">
      <label htmlFor={`${id}-precio`} className={clases.etiqueta}>
        {conLista ? "Precio final de la línea (Bs)" : "Monto (Bs)"}
      </label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="sm:w-48">
          <input
            id={`${id}-precio`}
            name="precio"
            defaultValue={estado?.valores?.precio ?? deCentavos(l.totalCents)}
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
        {l.manualPrice && (
          <button type="submit" name="restablecer" value="1" disabled={guardando} className={`${clases.botonSecundario} py-2.5`}>
            {l.paqueteVigente ? "Usar precio del paquete" : "Volver al precio original"}
          </button>
        )}
      </div>
      {conLista && !l.manualPrice && <p className={`${clases.ayuda} mt-2`}>Si lo cambias, ya no se recalcula al cambiar los invitados.</p>}
    </form>
  );
}
