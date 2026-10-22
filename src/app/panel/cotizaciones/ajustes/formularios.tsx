"use client";

import { useActionState, useState, useTransition } from "react";
import { IconoAccion } from "@/components/iconos";
import { Campo, clases } from "@/components/ui";
import { aCentavos, formatoBs } from "@/lib/cotizacion/dinero";
import type { EstadoPaquete, EstadoTipo } from "../ajustes-actions";

type Tema = "vino" | "oro" | "agua";

export type DatosPaquete = {
  id: string | null;
  nombre: string;
  precio: string;
  frase: string;
  descripcion: string;
  incluye: string;
  base: string;
  tema: Tema;
  activo: boolean;
};

const TEMAS: { valor: Tema; texto: string }[] = [
  { valor: "agua", texto: "Agua" },
  { valor: "vino", texto: "Vino" },
  { valor: "oro", texto: "Oro" },
];

const COLORES: Record<Tema, { tarjeta: string; texto: string; suave: string }> = {
  agua: { tarjeta: "bg-agua-700 text-agua-100", texto: "text-agua-100", suave: "text-agua-100/80" },
  vino: { tarjeta: "bg-vino-600 text-vino-50", texto: "text-vino-50", suave: "text-vino-50/80" },
  oro: { tarjeta: "bg-oro-700 text-oro-300", texto: "text-oro-300", suave: "text-oro-300/80" },
};

/** Vista previa de la tarjeta del paquete con los colores de su tema. */
function Vista({ d, baseNombre }: { d: DatosPaquete; baseNombre: string | null }) {
  const c = COLORES[d.tema];
  const centavos = aCentavos(d.precio);
  const items = d.incluye
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${c.tarjeta}`} aria-label="Vista previa del paquete">
      <p className="font-display text-xl break-words">{d.nombre.trim() || "Nombre del paquete"}</p>
      <p className="mt-1 text-2xl font-semibold">{centavos ? formatoBs(centavos) : "Bs —"}</p>
      {d.frase.trim() && <p className={`mt-2 text-sm break-words italic ${c.suave}`}>{d.frase.trim()}</p>}
      {baseNombre && <p className="mt-4 text-sm font-semibold">Incluye todo lo del paquete {baseNombre} +</p>}
      {items.length > 0 && (
        <ul className={`${baseNombre ? "mt-2" : "mt-4"} space-y-1 text-sm`}>
          {items.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className={c.suave}>
                •
              </span>
              <span className="min-w-0 break-words">{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type AccionPaquete = (prev: EstadoPaquete, formData: FormData) => Promise<EstadoPaquete>;

export function FormularioPaquete({
  accion,
  inicial,
  otros,
}: {
  accion: AccionPaquete;
  inicial: DatosPaquete;
  otros: { id: string; nombre: string }[];
}) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  const [d, setD] = useState(inicial);
  // Tras crear un paquete nuevo, el formulario vuelve a quedar vacío (el mensaje de éxito se conserva).
  const [visto, setVisto] = useState(estado);
  if (visto !== estado) {
    setVisto(estado);
    if (estado?.ok && inicial.id === null) setD(inicial);
  }
  const e = estado?.errores ?? {};
  const poner = <K extends keyof DatosPaquete>(k: K, v: DatosPaquete[K]) => setD((x) => ({ ...x, [k]: v }));
  const id = inicial.id ?? "nuevo";
  const baseNombre = otros.find((o) => o.id === d.base)?.nombre ?? null;

  return (
    <div className="grid items-start gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <form
        action={(fd) => {
          enviar(fd);
          // Deja la caja de "Incluye" sin renglones vacíos, como se guardó.
          poner(
            "incluye",
            d.incluye
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean)
              .join("\n"),
          );
        }}
        noValidate
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Campo id={`nombre-${id}`} etiqueta="Nombre" error={e.nombre}>
            <input
              id={`nombre-${id}`}
              name="nombre"
              value={d.nombre}
              onChange={(ev) => poner("nombre", ev.target.value)}
              maxLength={60}
              aria-invalid={Boolean(e.nombre) || undefined}
              className={clases.campo}
            />
          </Campo>
          <Campo id={`precio-${id}`} etiqueta="Precio (Bs)" error={e.precio} ayuda="Ej. 6.000">
            <input
              id={`precio-${id}`}
              name="precio"
              inputMode="decimal"
              value={d.precio}
              onChange={(ev) => poner("precio", ev.target.value)}
              aria-invalid={Boolean(e.precio) || undefined}
              className={clases.campo}
            />
          </Campo>
        </div>

        <Campo id={`frase-${id}`} etiqueta="Frase corta" error={e.frase}>
          <input
            id={`frase-${id}`}
            name="frase"
            value={d.frase}
            onChange={(ev) => poner("frase", ev.target.value)}
            maxLength={160}
            className={clases.campo}
          />
        </Campo>

        <Campo id={`descripcion-${id}`} etiqueta="Descripción" error={e.descripcion}>
          <textarea
            id={`descripcion-${id}`}
            name="descripcion"
            rows={3}
            value={d.descripcion}
            onChange={(ev) => poner("descripcion", ev.target.value)}
            maxLength={600}
            className={clases.campo}
          />
        </Campo>

        <Campo id={`incluye-${id}`} etiqueta="Incluye" error={e.incluye} ayuda="Un ítem por renglón (máximo 40).">
          <textarea
            id={`incluye-${id}`}
            name="incluye"
            rows={6}
            value={d.incluye}
            onChange={(ev) => poner("incluye", ev.target.value)}
            aria-invalid={Boolean(e.incluye) || undefined}
            className={clases.campo}
          />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id={`base-${id}`} etiqueta="Incluye todo lo de…" error={e.base} ayuda="Opcional: paquete del que hereda.">
            <select
              id={`base-${id}`}
              name="base"
              value={d.base}
              onChange={(ev) => poner("base", ev.target.value)}
              aria-invalid={Boolean(e.base) || undefined}
              className={clases.campo}
            >
              <option value="">Ninguno</option>
              {otros.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id={`tema-${id}`} etiqueta="Color" error={e.tema}>
            <select id={`tema-${id}`} name="tema" value={d.tema} onChange={(ev) => poner("tema", ev.target.value as Tema)} className={clases.campo}>
              {TEMAS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.texto}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <label className="flex items-center gap-2 text-sm text-texto">
          <input
            type="checkbox"
            name="activo"
            checked={d.activo}
            onChange={(ev) => poner("activo", ev.target.checked)}
            className="size-4 accent-[var(--color-primario)]"
          />
          Activo (se puede elegir en cotizaciones)
        </label>

        {estado?.error && (
          <p role="alert" className={clases.error}>
            {estado.error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pendiente} className={clases.botonPrimario}>
            <IconoAccion accion="check" /> {pendiente ? "Guardando…" : "Guardar paquete"}
          </button>
          {estado?.ok && (
            <p role="status" className="text-xs font-medium text-agua-700 dark:text-agua-300">
              {estado.ok}
            </p>
          )}
        </div>
      </form>

      <div className="lg:sticky lg:top-4">
        <p className="mb-2 text-xs font-medium tracking-wide text-texto-suave uppercase">Vista previa</p>
        <Vista d={d} baseNombre={baseNombre} />
      </div>
    </div>
  );
}

/* ── Tipos de evento ────────────────────────────────────────── */

type AccionTipo = (prev: EstadoTipo, formData: FormData) => Promise<EstadoTipo>;

export function NuevoTipo({ accion }: { accion: AccionTipo }) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  return (
    <form action={enviar} noValidate key={JSON.stringify(estado ?? null)} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="nuevo-tipo" className="sr-only">
          Nuevo tipo de evento
        </label>
        <input
          id="nuevo-tipo"
          name="nombre"
          defaultValue={estado?.ok ? "" : estado?.valor}
          placeholder="Ej. Bautizo"
          maxLength={40}
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

export function RenombrarTipo({ accion, nombre, id }: { accion: AccionTipo; nombre: string; id: string }) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  return (
    <form action={enviar} noValidate key={JSON.stringify(estado ?? null)} className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <label htmlFor={`tipo-${id}`} className="sr-only">
          Nombre del tipo de evento
        </label>
        <input
          id={`tipo-${id}`}
          name="nombre"
          defaultValue={estado?.valor ?? nombre}
          maxLength={40}
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

/** Flechas para subir o bajar el paquete en el orden. */
export function MoverPaquete({ nombre, alSubir, alBajar }: { nombre: string; alSubir?: () => Promise<string | void>; alBajar?: () => Promise<string | void> }) {
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
