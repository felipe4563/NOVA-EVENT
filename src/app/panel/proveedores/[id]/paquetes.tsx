"use client";

import { useActionState, useId, useState } from "react";
import { BotonConfirmar } from "@/components/boton-confirmar";
import { IconoAccion } from "@/components/iconos";
import { Aviso, Campo, Insignia, clases } from "@/components/ui";
import { deCentavos, formatoBs } from "@/lib/cotizacion/dinero";
import { actualizarPaquete, crearPaquete, eliminarPaquete, type EstadoPaquete } from "../paquetes-actions";

export type PaqueteFila = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  pricing: "fixed" | "per_person";
  active: boolean;
};

export function Paquetes({ supplierId, paquetes, editable }: { supplierId: string; paquetes: PaqueteFila[]; editable: boolean }) {
  return (
    <div className="space-y-4">
      {paquetes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-borde px-4 py-6 text-center text-sm text-texto-suave">Este proveedor todavía no tiene paquetes.</p>
      ) : (
        <ul className="divide-y divide-borde rounded-xl border border-borde">
          {paquetes.map((p) => (
            <Fila key={p.id} paquete={p} editable={editable} />
          ))}
        </ul>
      )}
      {editable && (
        <details className="rounded-xl border border-borde bg-superficie-2/40 p-4">
          <summary className="cursor-pointer text-sm font-medium text-texto">Agregar paquete</summary>
          <div className="mt-4">
            <FormularioPaquete accion={crearPaquete.bind(null, supplierId)} etiquetaBoton="Agregar paquete" limpiarAlGuardar />
          </div>
        </details>
      )}
    </div>
  );
}

function Fila({ paquete: p, editable }: { paquete: PaqueteFila; editable: boolean }) {
  const [editando, setEditando] = useState(false);
  return (
    <li className={`p-4 ${p.active ? "" : "opacity-60"}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium text-texto">
            {p.name}
            {!p.active && <Insignia tono="error">Inactivo</Insignia>}
          </p>
          {p.description && <p className="mt-0.5 text-sm whitespace-pre-line text-texto-suave">{p.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="text-sm font-semibold text-texto">
            {formatoBs(p.priceCents)}
            {p.pricing === "per_person" && <span className="font-normal text-texto-suave"> por persona</span>}
          </p>
          {editable && (
            <>
              <button type="button" onClick={() => setEditando((v) => !v)} className="rounded-lg px-2.5 py-1.5 text-sm text-enlace hover:bg-superficie-2">
                {editando ? "Cerrar" : "Editar"}
              </button>
              <BotonConfirmar
                accion={eliminarPaquete.bind(null, p.id)}
                titulo={`¿Eliminar «${p.name}»?`}
                mensaje="El paquete se borra para siempre. Las cotizaciones ya hechas conservan su precio."
                textoConfirmar="Eliminar"
                peligro
                className="rounded-lg p-2 text-error hover:bg-error/10"
              >
                <IconoAccion accion="basura" />
                <span className="sr-only">Eliminar {p.name}</span>
              </BotonConfirmar>
            </>
          )}
        </div>
      </div>
      {editable && editando && (
        <div className="mt-4 border-t border-borde pt-4">
          <FormularioPaquete
            accion={actualizarPaquete.bind(null, p.id)}
            etiquetaBoton="Guardar paquete"
            inicial={{
              nombre: p.name,
              descripcion: p.description ?? "",
              precio: deCentavos(p.priceCents),
              tarifa: p.pricing,
              activo: p.active,
            }}
          />
        </div>
      )}
    </li>
  );
}

type Valores = NonNullable<NonNullable<EstadoPaquete>["valores"]>;

function FormularioPaquete({
  accion,
  etiquetaBoton,
  inicial,
  limpiarAlGuardar,
}: {
  accion: (prev: EstadoPaquete, formData: FormData) => Promise<EstadoPaquete>;
  etiquetaBoton: string;
  inicial?: Valores;
  limpiarAlGuardar?: boolean;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  const e = estado?.errores ?? {};
  // Tras enviar, React limpia el formulario: se vuelve a poner lo escrito (o lo guardado).
  const v: Valores = limpiarAlGuardar && estado?.ok ? {} : { ...inicial, ...estado?.valores };
  const base = useId();
  const id = (c: string) => `${c}-${base}`;

  return (
    <form action={enviar} noValidate className="space-y-4" key={JSON.stringify(estado ?? null)}>
      {estado?.ok && <Aviso>{estado.ok}</Aviso>}
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <div className="grid gap-4 md:grid-cols-2">
        <Campo id={id("nombre")} etiqueta="Nombre del paquete" error={e.nombre}>
          <input id={id("nombre")} name="nombre" defaultValue={v.nombre ?? ""} required maxLength={120} autoComplete="off" placeholder="Ej. Menú criollo" aria-invalid={Boolean(e.nombre) || undefined} className={clases.campo} />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo id={id("precio")} etiqueta="Precio (Bs)" error={e.precio} ayuda="Ej. 2.500 o 85,50">
            <input id={id("precio")} name="precio" defaultValue={v.precio ?? ""} required inputMode="decimal" autoComplete="off" placeholder="85" aria-invalid={Boolean(e.precio) || undefined} className={clases.campo} />
          </Campo>
          <Campo id={id("tarifa")} etiqueta="Se cobra" error={e.tarifa}>
            <select id={id("tarifa")} name="tarifa" defaultValue={v.tarifa ?? "fixed"} className={clases.campo}>
              <option value="fixed">Precio fijo</option>
              <option value="per_person">Por persona</option>
            </select>
          </Campo>
        </div>
      </div>
      <Campo id={id("descripcion")} etiqueta="Descripción (opcional)" error={e.descripcion}>
        <textarea id={id("descripcion")} name="descripcion" defaultValue={v.descripcion ?? ""} rows={2} maxLength={500} className={`${clases.campo} resize-y`} />
      </Campo>
      <label className="flex items-center gap-3 text-sm text-texto">
        <input type="checkbox" name="activo" defaultChecked={v.activo ?? true} className="size-4 accent-primario" />
        Paquete activo (disponible para cotizar)
      </label>
      <div className="flex sm:justify-end">
        <button type="submit" disabled={pendiente} className={clases.botonPrimario}>
          {pendiente ? "Guardando…" : etiquetaBoton}
        </button>
      </div>
    </form>
  );
}
