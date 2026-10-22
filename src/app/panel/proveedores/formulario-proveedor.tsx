"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Aviso, Campo, clases } from "@/components/ui";
import type { EstadoProveedor } from "./actions";

type Categoria = { id: string; name: string };
type Valores = NonNullable<NonNullable<EstadoProveedor>["valores"]>;

export function FormularioProveedor({
  accion,
  categorias,
  inicial,
  esNuevo,
}: {
  accion: (prev: EstadoProveedor, formData: FormData) => Promise<EstadoProveedor>;
  categorias: Categoria[];
  inicial?: Valores;
  esNuevo: boolean;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  const e = estado?.errores ?? {};
  // Tras enviar, React limpia el formulario: se vuelve a poner lo escrito (o lo guardado).
  const v: Valores = { ...inicial, ...estado?.valores };

  const texto = (id: keyof Valores & string, etiqueta: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, ayuda?: string) => (
    <Campo id={id} etiqueta={etiqueta} error={e[id as keyof typeof e]} ayuda={ayuda}>
      <input
        id={id}
        name={id}
        defaultValue={String(v[id] ?? "")}
        autoComplete="off"
        aria-invalid={Boolean(e[id as keyof typeof e]) || undefined}
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
        <legend className="mb-4 font-semibold text-texto">Datos del negocio</legend>
        <div className="grid gap-5 md:grid-cols-2">
          {texto("nombre", "Nombre del negocio", { required: true, placeholder: "Ej. Salón Los Jardines" })}
          <Campo id="categoria" etiqueta="Categoría" error={e.categoria}>
            <select id="categoria" name="categoria" defaultValue={v.categoria ?? ""} required aria-invalid={Boolean(e.categoria) || undefined} className={clases.campo}>
              <option value="" disabled>
                Elige una categoría…
              </option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <div className="max-w-xs">
          {texto("capacidad", "Capacidad en personas (opcional)", { inputMode: "numeric", placeholder: "Ej. 300" }, "Para salones y locales. Déjalo vacío si no aplica.")}
        </div>
        <Campo id="servicios" etiqueta="Servicios que ofrece (opcional)" error={e.servicios} ayuda="Capacidad, paquetes, estilos, zonas donde trabaja…">
          <textarea id="servicios" name="servicios" defaultValue={v.servicios} rows={3} maxLength={2000} className={`${clases.campo} resize-y`} />
        </Campo>
      </fieldset>

      <fieldset className="space-y-5 border-t border-borde pt-6">
        <legend className="sr-only">Contacto</legend>
        <h3 aria-hidden className="font-semibold text-texto">Contacto</h3>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {texto("contacto", "Persona de contacto (opcional)")}
          {texto("telefono", "Teléfono o WhatsApp (opcional)", { type: "tel", inputMode: "tel" })}
          {texto("email", "Correo (opcional)", { type: "email", inputMode: "email" })}
          {texto("direccion", "Dirección o zona (opcional)")}
          {texto("web", "Web o redes (opcional)", { placeholder: "instagram.com/…" })}
        </div>
      </fieldset>

      <fieldset className="space-y-5 border-t border-borde pt-6">
        <legend className="sr-only">Uso interno</legend>
        <h3 aria-hidden className="font-semibold text-texto">Uso interno</h3>
        <Campo id="notas" etiqueta="Notas del equipo (opcional)" error={e.notas} ayuda="Precios conversados, cómo trabaja, recomendaciones… El proveedor nunca ve esto.">
          <textarea id="notas" name="notas" defaultValue={v.notas} rows={3} maxLength={2000} className={`${clases.campo} resize-y`} />
        </Campo>
        <label className="flex items-start gap-3 rounded-xl border border-borde bg-superficie-2/50 p-4">
          <input type="checkbox" name="activo" defaultChecked={v.activo ?? true} className="mt-0.5 size-4 accent-primario" />
          <span>
            <span className="block text-sm font-medium text-texto">Proveedor activo</span>
            <span className="block text-xs text-texto-suave">Si lo desmarcas, deja de aparecer al buscar proveedores libres, pero se conservan sus datos.</span>
          </span>
        </label>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 border-t border-borde pt-5 sm:flex-row sm:justify-end">
        {esNuevo && (
          <Link href="/panel/proveedores" className={clases.botonSecundario}>
            Cancelar
          </Link>
        )}
        <button type="submit" disabled={pendiente} className={clases.botonPrimario}>
          {pendiente ? "Guardando…" : esNuevo ? "Crear proveedor" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
