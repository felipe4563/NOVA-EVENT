"use client";
/* eslint-disable @next/next/no-img-element -- vistas previas del logo (archivo local o /marca) */

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { IconoAccion } from "@/components/iconos";
import { Aviso, Campo, clases } from "@/components/ui";
import type { TipoLogo } from "@/lib/archivos";
import { guardarEmpresa, subirLogo, type EstadoEmpresa } from "./actions";

const POLITICA_SUGERIDA =
  "Cambio de fecha: se permite un cambio sin costo avisando con al menos 60 días de anticipación, sujeto a la disponibilidad de los proveedores; lo pagado pasa a la nueva fecha. Un segundo cambio, o con menos de 60 días, tiene un recargo del 10 %. Cancelación: el anticipo no es reembolsable. Con más de 90 días de anticipación se devuelve lo pagado aparte del anticipo, menos lo ya pagado a proveedores que no se pueda recuperar. Con menos de 30 días no hay devolución.";

type Valores = NonNullable<NonNullable<EstadoEmpresa>["valores"]>;

export function FormularioEmpresa({ inicial }: { inicial: Valores }) {
  const [estado, enviar, pendiente] = useActionState(guardarEmpresa, undefined);
  const e = estado?.errores ?? {};
  const politicaRef = useRef<HTMLTextAreaElement>(null);
  const v: Valores = { ...inicial, ...estado?.valores };

  const campo = (id: keyof Valores, etiqueta: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, ayuda?: string) => (
    <Campo id={id} etiqueta={etiqueta} error={e[id]} ayuda={ayuda}>
      <input id={id} name={id} defaultValue={v[id] ?? ""} aria-invalid={Boolean(e[id]) || undefined} className={clases.campo} {...extra} />
    </Campo>
  );

  return (
    <form action={enviar} noValidate className="space-y-6" key={JSON.stringify(estado ?? null)}>
      {estado?.ok && <Aviso>{estado.ok}</Aviso>}
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}

      <fieldset className="space-y-5">
        <legend className="mb-4 font-semibold text-texto">Datos de la empresa</legend>
        <div className="grid gap-5 md:grid-cols-2">
          {campo("nombre", "Nombre comercial", { required: true, maxLength: 80 })}
          {campo("lema", "Lema (opcional)", { maxLength: 120 }, "Aparece bajo el logo en las propuestas y el PDF.")}
        </div>
      </fieldset>

      <fieldset className="space-y-5 border-t border-borde pt-6">
        <legend className="sr-only">Contacto</legend>
        <h3 aria-hidden className="font-semibold text-texto">
          Contacto
        </h3>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {campo("whatsapp", "WhatsApp (opcional)", { type: "tel", inputMode: "tel", placeholder: "+591 71234567" }, "Con código de país. Los novios lo usan desde la propuesta.")}
          {campo("telefono", "Teléfono (opcional)", { type: "tel", inputMode: "tel" })}
          {campo("correo", "Correo (opcional)", { type: "email", inputMode: "email" })}
          {campo("direccion", "Dirección (opcional)", { maxLength: 200 })}
          {campo("ciudad", "Ciudad (opcional)", { maxLength: 80, placeholder: "La Paz, Bolivia" })}
          {campo("web", "Sitio web (opcional)", { placeholder: "novaevent.bo" })}
        </div>
      </fieldset>

      <fieldset className="space-y-5 border-t border-borde pt-6">
        <legend className="sr-only">Redes sociales</legend>
        <h3 aria-hidden className="font-semibold text-texto">
          Redes sociales
        </h3>
        <div className="grid gap-5 md:grid-cols-3">
          {campo("instagram", "Instagram (opcional)", { placeholder: "@nova.event" })}
          {campo("facebook", "Facebook (opcional)", { placeholder: "facebook.com/novaevent" })}
          {campo("tiktok", "TikTok (opcional)", { placeholder: "@nova.event" })}
        </div>
        <p className={clases.ayuda}>Puedes escribir solo el usuario o pegar el enlace completo.</p>
      </fieldset>

      <fieldset className="space-y-3 border-t border-borde pt-6">
        <legend className="sr-only">Política de cambios y cancelación</legend>
        <h3 aria-hidden className="font-semibold text-texto">
          Política de cambios y cancelación
        </h3>
        <Campo id="politica" etiqueta="Texto de la política (opcional)" error={e.politica} ayuda="Se muestra a la pareja junto a sus pagos.">
          <textarea
            id="politica"
            name="politica"
            ref={politicaRef}
            defaultValue={v.politica ?? ""}
            rows={7}
            maxLength={3000}
            aria-invalid={Boolean(e.politica) || undefined}
            className={`${clases.campo} resize-y`}
          />
        </Campo>
        <button
          type="button"
          onClick={() => {
            if (politicaRef.current) politicaRef.current.value = POLITICA_SUGERIDA;
          }}
          className={clases.botonSecundario}
        >
          Usar texto sugerido
        </button>
      </fieldset>

      <div className="flex justify-end border-t border-borde pt-5">
        <button type="submit" disabled={pendiente} className={clases.botonPrimario}>
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

/** Subir un logo con vista previa antes de guardarlo. */
export function SubirLogo({ tipo }: { tipo: TipoLogo }) {
  const [estado, enviar, pendiente] = useActionState(subirLogo.bind(null, tipo), undefined);
  const [previa, setPrevia] = useState<string | null>(null);
  const id = useId();
  // Al guardar bien, se quita la vista previa (el logo nuevo ya se ve arriba).
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    if (estado?.ok) setPrevia(null);
  }

  // Libera la vista previa local al cambiarla o al salir.
  useEffect(() => () => void (previa && URL.revokeObjectURL(previa)), [previa]);

  return (
    <form action={enviar} key={JSON.stringify(estado ?? null)} className="space-y-3">
      {previa && (
        <div className={`flex h-28 items-center justify-center rounded-xl p-3 ring-1 ring-borde ${tipo === "claro" ? "bg-[#fbf6f3]" : "bg-carbon"}`}>
          <img src={previa} alt="Vista previa del logo nuevo" className="max-h-full max-w-full object-contain" />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="sr-only">
          Logo {tipo}
        </label>
        <input
          id={id}
          name="logo"
          type="file"
          accept="image/png,image/webp,image/jpeg"
          required
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            setPrevia(f ? URL.createObjectURL(f) : null);
          }}
          className="block w-full text-sm text-texto-suave file:mr-3 file:rounded-lg file:border-0 file:bg-activo file:px-3 file:py-2 file:text-sm file:font-medium file:text-titulo hover:file:opacity-90"
        />
        <button type="submit" disabled={pendiente || !previa} className={`${clases.botonPrimario} shrink-0`}>
          <IconoAccion accion="check" /> {pendiente ? "Subiendo…" : "Guardar logo"}
        </button>
      </div>
      {estado?.error && <p className={clases.error}>{estado.error}</p>}
      {estado?.ok && <p className="text-xs font-medium text-agua-700 dark:text-agua-300">{estado.ok}</p>}
    </form>
  );
}
