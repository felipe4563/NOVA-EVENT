"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Aviso, Campo, clases } from "@/components/ui";
import type { EstadoCotizacion } from "../actions";

type Valores = NonNullable<NonNullable<EstadoCotizacion>["valores"]>;
type Opcion = { id: string; name: string };

/** Datos del evento de una cotización: sirve para crearla y para editarla en el armado. */
export function FormularioDatos({
  accion,
  tipos,
  equipo,
  inicial,
  esNueva,
}: {
  accion: (prev: EstadoCotizacion, formData: FormData) => Promise<EstadoCotizacion>;
  tipos: Opcion[];
  equipo: Opcion[];
  inicial?: Valores;
  esNueva: boolean;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  const e = estado?.errores ?? {};
  // Tras enviar, React limpia el formulario: se vuelve a poner lo escrito (o lo guardado).
  const v: Valores = { ...inicial, ...estado?.valores };

  const campo = (id: keyof typeof e & string, etiqueta: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, ayuda?: string) => (
    <Campo id={id} etiqueta={etiqueta} error={e[id]} ayuda={ayuda}>
      <input
        id={id}
        name={id}
        defaultValue={String(v[id] ?? "")}
        autoComplete="off"
        aria-invalid={Boolean(e[id]) || undefined}
        aria-describedby={e[id] ? `${id}-error` : undefined}
        className={clases.campo}
        {...extra}
      />
    </Campo>
  );

  return (
    <form action={enviar} noValidate className="space-y-6" key={JSON.stringify(estado ?? null)}>
      {estado?.ok && <Aviso>{estado.ok}</Aviso>}
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}

      <fieldset className="space-y-5">
        <legend className="mb-4 font-semibold text-texto">Cliente</legend>
        <div className="grid gap-5 md:grid-cols-3">
          {campo("cliente", "Nombre del cliente", { required: true, placeholder: "Ej. María Pérez" })}
          {campo("telefono", "Teléfono o WhatsApp (opcional)", { type: "tel", inputMode: "tel" })}
          {campo("email", "Correo (opcional)", { type: "email", inputMode: "email" })}
        </div>
      </fieldset>

      <fieldset className="space-y-5 border-t border-borde pt-6">
        <legend className="sr-only">Evento</legend>
        <h3 aria-hidden className="font-semibold text-texto">Evento</h3>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Campo id="tipo" etiqueta="Tipo de evento" error={e.tipo}>
            <select id="tipo" name="tipo" defaultValue={v.tipo ?? ""} required aria-invalid={Boolean(e.tipo) || undefined} className={clases.campo}>
              <option value="" disabled>
                Elige un tipo…
              </option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Campo>
          {campo("fecha", "Fecha del evento", { type: "date", required: true })}
          {campo("invitados", "Invitados", { type: "number", inputMode: "numeric", min: 1, max: 5000, required: true, placeholder: "Ej. 150" })}
          {campo("inicio", "Hora de inicio (opcional)", { type: "time" })}
          {campo("fin", "Hora de fin (opcional)", { type: "time" })}
        </div>
      </fieldset>

      <fieldset className="space-y-5 border-t border-borde pt-6">
        <legend className="sr-only">Presupuesto y validez</legend>
        <h3 aria-hidden className="font-semibold text-texto">Presupuesto y validez</h3>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {campo("presupuesto", "Presupuesto del cliente en Bs (opcional)", { inputMode: "decimal", placeholder: "Ej. 15.000" }, "Sirve para la barra de presupuesto del armado.")}
          {campo("validez", "Propuesta válida hasta (opcional)", { type: "date" })}
          <Campo id="responsable" etiqueta="Responsable" error={e.responsable}>
            <select id="responsable" name="responsable" defaultValue={v.responsable ?? ""} aria-invalid={Boolean(e.responsable) || undefined} className={clases.campo}>
              {equipo.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-start gap-3 rounded-xl border border-borde bg-superficie-2/50 p-4">
            <input type="checkbox" name="incluirNova" defaultChecked={v.incluirNova ?? false} className="mt-0.5 size-4 accent-primario" />
            <span>
              <span className="block text-sm font-medium text-texto">Incluir el paquete de Nova Event en el presupuesto</span>
              <span className="block text-xs text-texto-suave">Si no, la barra solo cuenta a los proveedores.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-borde bg-superficie-2/50 p-4">
            <input type="checkbox" name="mostrarPresupuesto" defaultChecked={v.mostrarPresupuesto ?? false} className="mt-0.5 size-4 accent-primario" />
            <span>
              <span className="block text-sm font-medium text-texto">Mostrar el presupuesto al cliente</span>
              <span className="block text-xs text-texto-suave">En la propuesta aparecerán el presupuesto y la barra.</span>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-5 border-t border-borde pt-6">
        <legend className="sr-only">Uso interno</legend>
        <h3 aria-hidden className="font-semibold text-texto">Uso interno</h3>
        <Campo id="notas" etiqueta="Notas internas (opcional)" error={e.notas} ayuda="El cliente nunca ve esto.">
          <textarea id="notas" name="notas" defaultValue={v.notas} rows={3} maxLength={2000} className={`${clases.campo} resize-y`} />
        </Campo>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 border-t border-borde pt-5 sm:flex-row sm:justify-end">
        {esNueva && (
          <Link href="/panel/cotizaciones" className={clases.botonSecundario}>
            Cancelar
          </Link>
        )}
        <button type="submit" disabled={pendiente} className={clases.botonPrimario}>
          {pendiente ? "Guardando…" : esNueva ? "Crear cotización" : "Guardar datos"}
        </button>
      </div>
    </form>
  );
}
