"use client";

import { useActionState, useId, useRef, useState } from "react";
import { IconoAccion } from "@/components/iconos";
import { Aviso, clases } from "@/components/ui";
import { aCentavos, deCentavos, formatoBs } from "@/lib/cotizacion/dinero";
import { cubrirCuotas, repartirFaltante } from "@/lib/saldos/reparto";
import { type EstadoPlan, guardarPlanPareja, guardarPlanProveedor } from "../../plan-actions";
import { Ventana } from "./ventana";

type CuotaEditable = { nombre: string; monto: number; vence: string };
type Fila = { clave: number; nombre: string; monto: string; vence: string };

const MAX_CUOTAS = 12;

/** Botón «Editar plan» y la ventana con las cuotas del plan de la pareja (`tipo="pareja"`, refId = cotización) o de un proveedor (refId = línea). */
export function EditarPlan({
  tipo,
  refId,
  titulo,
  cuotas,
  total,
  pagado,
  hoy,
}: {
  tipo: "pareja" | "proveedor";
  refId: string;
  titulo: string;
  cuotas: CuotaEditable[];
  /** Lo que el plan debe sumar: el total a cobrar (pareja) o el monto a pagar (proveedor). */
  total: number;
  /** Cobrado (pareja) o pagado (proveedor) hasta ahora. */
  pagado: number;
  hoy: string;
}) {
  return (
    <Ventana
      boton={
        <>
          <IconoAccion accion="editar" /> Editar plan
        </>
      }
      claseBoton={`${clases.botonSecundario} px-3 py-2`}
      titulo={titulo}
      descripcion="Cambia nombres, montos y fechas. La suma debe ser igual al total."
      ancho="w-[min(44rem,calc(100vw-2rem))]"
    >
      {(listo) => <Formulario key={JSON.stringify([cuotas, total])} tipo={tipo} refId={refId} cuotas={cuotas} total={total} pagado={pagado} hoy={hoy} listo={listo} />}
    </Ventana>
  );
}

function Formulario({
  tipo,
  refId,
  cuotas,
  total,
  pagado,
  hoy,
  listo,
}: {
  tipo: "pareja" | "proveedor";
  refId: string;
  cuotas: CuotaEditable[];
  total: number;
  pagado: number;
  hoy: string;
  listo: (mensaje?: string) => void;
}) {
  const siguiente = useRef(cuotas.length);
  const [filas, setFilas] = useState<Fila[]>(() => cuotas.map((c, i) => ({ clave: i, nombre: c.nombre, monto: deCentavos(c.monto), vence: c.vence })));
  const [estado, enviar, pendiente] = useActionState(async (prev: EstadoPlan, fd: FormData) => {
    const r = await (tipo === "pareja" ? guardarPlanPareja : guardarPlanProveedor)(refId, prev, fd);
    if (r?.ok) listo(r.ok);
    return r;
  }, undefined);
  const id = useId();

  const montos = filas.map((f) => aCentavos(f.monto));
  const montosValidos = montos.every((m) => m !== null && m > 0);
  const suma = montos.reduce<number>((s, m) => s + (m ?? 0), 0);
  const diferencia = total - suma;
  const completo = filas.every((f) => f.nombre.trim() && f.vence);
  const puedeGuardar = filas.length >= 1 && montosValidos && diferencia === 0 && completo && !pendiente;

  // «Repartir» trabaja con lo que está escrito (un monto ilegible cuenta como 0).
  const actuales = filas.map((f, i) => ({ nombre: f.nombre, monto: montos[i] ?? 0, vence: f.vence }));
  const sinNadaQueRepartir = !cubrirCuotas(actuales, pagado).cuotas.some((c) => c.falta > 0);
  const totalBajo = total < pagado;

  const cambiar = (clave: number, campo: "nombre" | "monto" | "vence", valor: string) => setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));
  const mover = (i: number, d: -1 | 1) =>
    setFilas((fs) => {
      const j = i + d;
      if (j < 0 || j >= fs.length) return fs;
      const copia = [...fs];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  const agregar = () => setFilas((fs) => [...fs, { clave: siguiente.current++, nombre: `Cuota ${fs.length + 1}`, monto: "", vence: hoy }]);
  const repartir = () => {
    const r = repartirFaltante(actuales, pagado, total);
    setFilas((fs) => fs.map((f, i) => ({ ...f, monto: deCentavos(r[i].monto) })));
  };

  const botonFila = "grid size-9 place-items-center rounded-lg border border-borde-campo text-texto-suave hover:text-titulo disabled:opacity-40 disabled:hover:text-texto-suave";

  return (
    <form action={enviar} noValidate className="space-y-4">
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}

      <ul className="space-y-3">
        {filas.map((f, i) => {
          const malMonto = f.monto.trim() !== "" && !montos[i];
          // En celular cada fila lleva sus etiquetas; en pantallas anchas solo la primera.
          const etiqueta = i === 0 ? clases.etiqueta : "text-sm font-medium text-texto sm:sr-only";
          return (
            <li key={f.clave} className="grid grid-cols-2 gap-2 rounded-xl bg-superficie-2/50 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_9.5rem_auto] sm:items-end sm:bg-transparent sm:p-0">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor={`${id}-n${f.clave}`} className={etiqueta}>
                  Nombre
                </label>
                <input id={`${id}-n${f.clave}`} name="nombre" value={f.nombre} maxLength={60} onChange={(e) => cambiar(f.clave, "nombre", e.target.value)} className={`${clases.campo} mt-1`} />
              </div>
              <div className="min-w-0">
                <label htmlFor={`${id}-m${f.clave}`} className={etiqueta}>
                  Monto (Bs)
                </label>
                <input
                  id={`${id}-m${f.clave}`}
                  name="monto"
                  value={f.monto}
                  inputMode="decimal"
                  placeholder="1.500,50"
                  aria-invalid={malMonto || undefined}
                  onChange={(e) => cambiar(f.clave, "monto", e.target.value)}
                  className={`${clases.campo} mt-1 tabular-nums`}
                />
              </div>
              <div className="min-w-0">
                <label htmlFor={`${id}-v${f.clave}`} className={etiqueta}>
                  Vence
                </label>
                <input id={`${id}-v${f.clave}`} name="vence" type="date" value={f.vence} onChange={(e) => cambiar(f.clave, "vence", e.target.value)} className={`${clases.campo} mt-1`} />
              </div>
              <div className="col-span-2 flex justify-end gap-1.5 sm:col-span-1">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir la cuota ${i + 1}`} className={botonFila}>
                  ↑
                </button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === filas.length - 1} aria-label={`Bajar la cuota ${i + 1}`} className={botonFila}>
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))}
                  disabled={filas.length === 1}
                  aria-label={`Quitar la cuota ${i + 1}`}
                  className={botonFila}
                >
                  <IconoAccion accion="basura" className="size-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={agregar} disabled={filas.length >= MAX_CUOTAS} className={`${clases.botonSecundario} px-3 py-2`}>
          <IconoAccion accion="mas" /> Agregar cuota
        </button>
        <button type="button" onClick={repartir} disabled={totalBajo || sinNadaQueRepartir} className={`${clases.botonSecundario} px-3 py-2`}>
          Repartir lo que falta
        </button>
      </div>
      {totalBajo && (
        <p className="text-xs text-texto-suave">
          El total ({formatoBs(total)}) es menor que lo ya registrado ({formatoBs(pagado)}): no se puede repartir.
        </p>
      )}
      {!totalBajo && sinNadaQueRepartir && <p className="text-xs text-texto-suave">Todas las cuotas están cubiertas: no queda nada por repartir.</p>}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-borde pt-3">
        <p className="text-sm tabular-nums" aria-live="polite">
          <span className="text-texto-suave">
            Total {formatoBs(total)} · Suma {formatoBs(suma)} ·{" "}
          </span>
          <span className={`font-semibold ${diferencia === 0 ? "text-agua-700 dark:text-agua-300" : "text-error"}`}>Diferencia: {formatoBs(diferencia)}</span>
        </p>
        <button type="submit" disabled={!puedeGuardar} className={clases.botonPrimario}>
          {pendiente ? "Guardando…" : "Guardar plan"}
        </button>
      </div>
    </form>
  );
}
