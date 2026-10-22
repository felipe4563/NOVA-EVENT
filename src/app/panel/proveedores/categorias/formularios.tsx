"use client";

import { useActionState, useState, useTransition } from "react";
import { IconoAccion } from "@/components/iconos";
import { clases } from "@/components/ui";
import type { EstadoCategoria } from "../actions";

type Accion = (prev: EstadoCategoria, formData: FormData) => Promise<EstadoCategoria>;

export function NuevaCategoria({ accion }: { accion: Accion }) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  return (
    <form action={enviar} noValidate key={JSON.stringify(estado ?? null)} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="nueva-categoria" className="sr-only">
          Nueva categoría
        </label>
        <input
          id="nueva-categoria"
          name="nombre"
          defaultValue={estado?.ok ? "" : estado?.valor}
          placeholder="Ej. Wedding planner"
          maxLength={60}
          aria-invalid={Boolean(estado?.error) || undefined}
          className={clases.campo}
        />
        <button type="submit" disabled={pendiente} className={`${clases.botonPrimario} shrink-0`}>
          <IconoAccion accion="mas" /> Agregar
        </button>
      </div>
      {estado?.error && <p className={clases.error}>{estado.error}</p>}
      {estado?.ok && <p className="text-xs font-medium text-agua-700 dark:text-agua-300">{estado.ok}</p>}
    </form>
  );
}

export function RenombrarCategoria({ accion, nombre, id }: { accion: Accion; nombre: string; id: string }) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  return (
    <form action={enviar} noValidate key={JSON.stringify(estado ?? null)} className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <label htmlFor={`cat-${id}`} className="sr-only">
          Nombre de la categoría
        </label>
        <input
          id={`cat-${id}`}
          name="nombre"
          defaultValue={estado?.valor ?? nombre}
          maxLength={60}
          aria-invalid={Boolean(estado?.error) || undefined}
          className={`${clases.campo} py-2`}
        />
        <button type="submit" disabled={pendiente} className={`${clases.botonSecundario} shrink-0 px-3 py-2`} title="Guardar nombre">
          <IconoAccion accion="check" />
          <span className="sr-only">Guardar nombre</span>
        </button>
      </div>
      {estado?.error && <p className={clases.error}>{estado.error}</p>}
      {estado?.ok && <p className="mt-1 text-xs text-agua-700 dark:text-agua-300">{estado.ok}</p>}
    </form>
  );
}

/** Flechas para subir o bajar la categoría en el orden. */
export function MoverCategoria({ nombre, alSubir, alBajar }: { nombre: string; alSubir?: () => Promise<string | void>; alBajar?: () => Promise<string | void> }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ir = (f: () => Promise<string | void>) =>
    iniciar(async () => {
      setError(null);
      const r = await f();
      if (r) setError(r);
    });
  const estilo = "rounded-lg px-2.5 py-1.5 text-sm text-texto-suave hover:bg-superficie-2 disabled:opacity-30";
  return (
    <div className="flex items-center gap-1">
      <button type="button" disabled={!alSubir || pendiente} onClick={() => alSubir && ir(alSubir)} className={estilo}>
        <span aria-hidden>↑</span>
        <span className="sr-only">Subir {nombre}</span>
      </button>
      <button type="button" disabled={!alBajar || pendiente} onClick={() => alBajar && ir(alBajar)} className={estilo}>
        <span aria-hidden>↓</span>
        <span className="sr-only">Bajar {nombre}</span>
      </button>
      {error && (
        <span role="alert" className="text-xs text-error">
          {error}
        </span>
      )}
    </div>
  );
}
