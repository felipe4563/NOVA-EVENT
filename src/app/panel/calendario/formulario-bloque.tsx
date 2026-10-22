"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Aviso, Campo, clases } from "@/components/ui";
import type { EstadoBloque } from "./actions";

type Valores = NonNullable<NonNullable<EstadoBloque>["valores"]>;

export function FormularioBloque({
  accion,
  inicial,
  esNuevo,
  cancelarHref,
  ayudaDetalle,
}: {
  accion: (prev: EstadoBloque, formData: FormData) => Promise<EstadoBloque>;
  inicial: Valores;
  esNuevo: boolean;
  /** Al editar: adónde vuelve "Cancelar". */
  cancelarHref?: string;
  ayudaDetalle: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  const e = estado?.errores ?? {};
  const v: Valores = { ...inicial, ...estado?.valores };
  // Vive fuera del formulario para no perderse cuando React lo reinicia al enviar.
  const [todoElDia, setTodoElDia] = useState(v.todoElDia ?? true);
  const [varios, setVarios] = useState(Boolean(v.hasta));

  return (
    <form action={enviar} noValidate className="space-y-4" key={JSON.stringify(estado ?? null)}>
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}

      <div className={`grid gap-4 ${varios ? "sm:grid-cols-2" : ""}`}>
        <Campo id="desde" etiqueta={varios ? "Desde" : "Fecha"} error={e.desde}>
          <input id="desde" name="desde" type="date" defaultValue={v.desde} required aria-invalid={Boolean(e.desde) || undefined} className={clases.campo} />
        </Campo>
        {varios && (
          <Campo id="hasta" etiqueta="Hasta" error={e.hasta}>
            <input id="hasta" name="hasta" type="date" defaultValue={v.hasta} min={v.desde} aria-invalid={Boolean(e.hasta) || undefined} className={clases.campo} />
          </Campo>
        )}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {esNuevo && (
          <label className="flex items-center gap-2 text-sm text-texto">
            <input type="checkbox" checked={varios} onChange={(ev) => setVarios(ev.target.checked)} className="size-4 accent-primario" />
            Varios días seguidos
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-texto">
          <input
            type="checkbox"
            name="todoElDia"
            checked={todoElDia}
            onChange={(ev) => setTodoElDia(ev.target.checked)}
            className="size-4 accent-primario"
          />
          Todo el día
        </label>
      </div>

      {!todoElDia && (
        <div className="grid grid-cols-2 gap-4">
          <Campo id="inicio" etiqueta="Desde las" error={e.inicio}>
            <input id="inicio" name="inicio" type="time" defaultValue={v.inicio} aria-invalid={Boolean(e.inicio) || undefined} className={clases.campo} />
          </Campo>
          <Campo id="fin" etiqueta="Hasta las" error={e.fin}>
            <input id="fin" name="fin" type="time" defaultValue={v.fin} aria-invalid={Boolean(e.fin) || undefined} className={clases.campo} />
          </Campo>
        </div>
      )}

      <Campo id="detalle" etiqueta="Detalle (opcional)" error={e.detalle} ayuda={ayudaDetalle}>
        <input id="detalle" name="detalle" defaultValue={v.detalle} maxLength={200} placeholder="Ej. Boda en el salón principal" className={clases.campo} />
      </Campo>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {cancelarHref && (
          <Link href={cancelarHref} className={clases.botonSecundario}>
            Cancelar
          </Link>
        )}
        <button type="submit" disabled={pendiente} className={clases.botonPrimario}>
          {pendiente ? "Guardando…" : esNuevo ? "Marcar como ocupado" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
