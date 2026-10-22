"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { IconoAccion } from "@/components/iconos";
import { Insignia, clases } from "@/components/ui";
import { totalLinea } from "@/lib/cotizacion/calculo";
import { formatoBs } from "@/lib/cotizacion/dinero";
import { textoDisponibilidad } from "@/lib/cotizacion/disponibilidad";
import { agregarLinea, type EstadoArmado } from "../actions";
import type { OpcionProveedor } from "../datos";

const TONO_DISPONIBILIDAD = { libre: "agua", parcial: "oro", ocupado: "error" } as const;

/** Botón "Elegir" / "Agregar otro" que abre el buscador de proveedores de una categoría. */
export function ElegirProveedor({
  versionId,
  categoria,
  opciones,
  invitados,
  hayLineas,
}: {
  versionId: string;
  categoria: { id: string; name: string };
  opciones: OpcionProveedor[];
  invitados: number;
  hayLineas: boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  // Cada vez que se abre se monta de nuevo el contenido: sin errores ni búsquedas viejas.
  const [apertura, setApertura] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setApertura((n) => n + 1);
          dialogo.current?.showModal();
        }}
        className={hayLineas ? "inline-flex items-center gap-1.5 text-sm font-medium text-enlace hover:text-titulo" : `${clases.botonSecundario} px-3 py-2`}
      >
        <IconoAccion accion="mas" /> {hayLineas ? "Agregar otro" : "Elegir"}
      </button>
      <dialog
        ref={dialogo}
        aria-label={`Elegir ${categoria.name}`}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(48rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-borde bg-superficie p-0 text-texto shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:flex open:flex-col"
      >
        {apertura > 0 && (
          <Contenido key={apertura} versionId={versionId} categoria={categoria} opciones={opciones} invitados={invitados} cerrar={() => dialogo.current?.close()} />
        )}
      </dialog>
    </>
  );
}

function Contenido({
  versionId,
  categoria,
  opciones,
  invitados,
  cerrar,
}: {
  versionId: string;
  categoria: { id: string; name: string };
  opciones: OpcionProveedor[];
  invitados: number;
  cerrar: () => void;
}) {
  const [estado, enviar, pendiente] = useActionState(agregarLinea.bind(null, versionId), undefined);
  const [busqueda, setBusqueda] = useState("");
  useEffect(() => {
    if (estado?.ok) cerrar();
  }, [estado, cerrar]);
  const q = busqueda.trim().toLowerCase();
  const visibles = q ? opciones.filter((o) => o.nombre.toLowerCase().includes(q)) : opciones;

  return (
    <>
      <div className="shrink-0 border-b border-borde p-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.2em] text-acento uppercase">Elegir proveedor</p>
            <h2 className="mt-0.5 truncate font-display text-lg text-titulo">{categoria.name}</h2>
          </div>
          <button type="button" onClick={cerrar} className="rounded-full p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {opciones.length > 4 && (
          <label className="relative mt-3 block">
            <span className="sr-only">Buscar proveedor</span>
            <IconoAccion accion="buscar" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre" className={`${clases.campo} pl-9`} />
          </label>
        )}
        {estado?.error && (
          <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
            {estado.error}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:px-6">
        {opciones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-borde px-4 py-6 text-center text-sm text-texto-suave">No hay proveedores activos en esta categoría.</p>
        ) : visibles.length === 0 ? (
          <p className="px-1 py-4 text-sm text-texto-suave">Ningún proveedor coincide con «{busqueda}».</p>
        ) : (
          <ul className="space-y-3">
            {visibles.map((o) => (
              <Tarjeta key={o.id} o={o} categoriaId={categoria.id} invitados={invitados} enviar={enviar} pendiente={pendiente} estado={estado} />
            ))}
          </ul>
        )}

        <details className="mt-4 rounded-xl border border-borde bg-superficie-2/40 p-4" open={estado?.valores?.proveedor === "" || undefined}>
          <summary className="cursor-pointer text-sm font-medium text-texto">Sin proveedor: escribir un monto</summary>
          <FormularioMonto categoriaId={categoria.id} proveedorId="" enviar={enviar} pendiente={pendiente} estado={estado} etiquetaObligatoria />
        </details>
      </div>
    </>
  );
}

function Tarjeta({
  o,
  categoriaId,
  invitados,
  enviar,
  pendiente,
  estado,
}: {
  o: OpcionProveedor;
  categoriaId: string;
  invitados: number;
  enviar: (fd: FormData) => void;
  pendiente: boolean;
  estado: EstadoArmado;
}) {
  const [manual, setManual] = useState(estado?.valores?.proveedor === o.id && !estado.valores.paquete);
  return (
    <li className={`overflow-hidden rounded-xl border ${o.disponibilidad === "ocupado" ? "border-error/30" : "border-borde"}`}>
      <div className="flex gap-3 p-3">
        {o.portada ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagen privada, ya optimizada
          <img src={o.portada} alt="" loading="lazy" className="size-16 shrink-0 rounded-lg object-cover sm:size-20" />
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-activo text-lg font-semibold text-titulo sm:size-20" aria-hidden>
            {o.nombre.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold break-words text-texto">{o.nombre}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Insignia tono={TONO_DISPONIBILIDAD[o.disponibilidad]}>{textoDisponibilidad(o.disponibilidad, o.rangos)}</Insignia>
            {o.capacidad !== null && (
              <Insignia tono={o.sinCapacidad ? "error" : "neutro"}>{o.sinCapacidad ? `Capacidad ${o.capacidad}, invitados ${invitados}` : `Capacidad ${o.capacidad}`}</Insignia>
            )}
          </div>
        </div>
      </div>

      {o.paquetes.length > 0 && (
        <form action={enviar} className="border-t border-borde bg-superficie-2/40">
          <input type="hidden" name="categoria" value={categoriaId} />
          <input type="hidden" name="proveedor" value={o.id} />
          <ul className="divide-y divide-borde">
            {o.paquetes.map((p) => (
              <li key={p.id}>
                <button type="submit" name="paquete" value={p.id} disabled={pendiente} className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-activo disabled:opacity-60">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-texto">{p.name}</span>
                    {p.description && <span className="line-clamp-2 block text-xs text-texto-suave">{p.description}</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold text-texto tabular-nums">{formatoBs(totalLinea(p.pricing, p.priceCents, invitados))}</span>
                    {p.pricing === "per_person" && (
                      <span className="block text-xs text-texto-suave tabular-nums">
                        {formatoBs(p.priceCents)} × {invitados}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </form>
      )}
      <div className="border-t border-borde px-3 py-2">
        <button type="button" onClick={() => setManual((v) => !v)} aria-expanded={manual} className="text-sm font-medium text-enlace hover:text-titulo">
          {o.paquetes.length ? "Monto manual" : "Elegir con monto manual"}
        </button>
        {manual && <FormularioMonto categoriaId={categoriaId} proveedorId={o.id} enviar={enviar} pendiente={pendiente} estado={estado} />}
      </div>
    </li>
  );
}

function FormularioMonto({
  categoriaId,
  proveedorId,
  enviar,
  pendiente,
  estado,
  etiquetaObligatoria = false,
}: {
  categoriaId: string;
  proveedorId: string;
  enviar: (fd: FormData) => void;
  pendiente: boolean;
  estado: EstadoArmado;
  etiquetaObligatoria?: boolean;
}) {
  const id = useId();
  // Los errores solo se muestran en el formulario que se envió.
  const mio = estado?.valores?.proveedor === proveedorId && !estado.valores.paquete;
  const e = mio ? (estado?.errores ?? {}) : {};
  const v = mio ? (estado?.valores ?? {}) : {};
  return (
    <form action={enviar} noValidate className="mt-3 grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-start" key={mio ? JSON.stringify(estado) : "nuevo"}>
      <input type="hidden" name="categoria" value={categoriaId} />
      <input type="hidden" name="proveedor" value={proveedorId} />
      <div>
        <label htmlFor={`${id}-etiqueta`} className={clases.etiqueta}>
          {etiquetaObligatoria ? "Qué es" : "Detalle (opcional)"}
        </label>
        <input
          id={`${id}-etiqueta`}
          name="etiqueta"
          defaultValue={v.etiqueta ?? ""}
          maxLength={120}
          autoComplete="off"
          placeholder={etiquetaObligatoria ? "Ej. Traslado de invitados" : "Ej. Servicio de 4 horas"}
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
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={Boolean(e.precio) || undefined}
          className={`${clases.campo} mt-1.5`}
        />
        {e.precio ? <p className={clases.error}>{e.precio}</p> : <p className={clases.ayuda}>Ej. 2.500 o 85,50</p>}
      </div>
      <button type="submit" disabled={pendiente} className={`${clases.botonPrimario} sm:mt-[1.625rem]`}>
        Agregar
      </button>
    </form>
  );
}
