"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { IconoModulo } from "@/components/iconos";
import { Aviso, Campo, clases } from "@/components/ui";
import type { Action, ModuleKey } from "@/lib/permissions";
import type { EstadoRol } from "./actions";

type Modulo = { key: ModuleKey; label: string; grupo: string; acciones: { key: Action; label: string }[] };
type Tipo = { valor: string; etiqueta: string };

export function FormularioRol({
  accion,
  modulos,
  tipos,
  inicial,
  esNuevo,
  accesoTotal = false,
  tipoBloqueado = false,
}: {
  accion: (prev: EstadoRol, formData: FormData) => Promise<EstadoRol>;
  modulos: Modulo[];
  tipos: Tipo[];
  inicial?: { nombre: string; descripcion: string; tipo: string; permisos: string[] };
  esNuevo: boolean;
  /** Rol administrador: tiene todo y la matriz no se edita. */
  accesoTotal?: boolean;
  /** Los roles base no cambian de tipo de cuenta. */
  tipoBloqueado?: boolean;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  const e = estado?.errores ?? {};
  // Tras enviar, React limpia el formulario: se vuelve a poner lo escrito (o lo guardado).
  const v = { ...inicial, ...estado?.valores };

  return (
    <form action={enviar} noValidate className="space-y-6" key={JSON.stringify(estado ?? null)}>
      {estado?.ok && <Aviso>{estado.ok}</Aviso>}
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}

      <section className={`${clases.tarjeta} space-y-5 p-5 sm:p-7`}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo id="nombre" etiqueta="Nombre del rol" error={e.nombre}>
            <input id="nombre" name="nombre" defaultValue={v.nombre} required aria-invalid={Boolean(e.nombre) || undefined} className={clases.campo} />
          </Campo>
          <Campo
            id="tipo"
            etiqueta="Tipo de cuenta"
            error={e.tipo}
            ayuda={tipoBloqueado ? "Los roles base mantienen su tipo." : "A quién está pensado este rol."}
          >
            <select id="tipo" name="tipo" defaultValue={v.tipo ?? "staff"} disabled={tipoBloqueado} className={clases.campo}>
              {tipos.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo id="descripcion" etiqueta="Descripción (opcional)" error={e.descripcion}>
          <textarea id="descripcion" name="descripcion" defaultValue={v.descripcion} rows={2} maxLength={200} className={`${clases.campo} resize-y`} />
        </Campo>
      </section>

      <section className={`${clases.tarjeta} p-5 sm:p-7`}>
        <h2 className="font-semibold text-texto">Permisos</h2>
        {accesoTotal ? (
          <p className="mt-2 rounded-xl bg-activo px-4 py-3 text-sm text-titulo">
            Este rol tiene <strong>acceso total</strong>: puede ver, crear, editar y eliminar en todos los módulos, incluidos los que se agreguen en el futuro.
          </p>
        ) : (
          <MatrizPermisos modulos={modulos} inicial={v.permisos ?? []} />
        )}
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/panel/roles" className={clases.botonSecundario}>
          {esNuevo ? "Cancelar" : "Volver"}
        </Link>
        <button type="submit" disabled={pendiente} className={clases.botonPrimario}>
          {pendiente ? "Guardando…" : esNuevo ? "Crear rol" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

function MatrizPermisos({ modulos, inicial }: { modulos: Modulo[]; inicial: string[] }) {
  const [marcados, setMarcados] = useState(() => new Set(inicial));
  const grupos = [...new Set(modulos.map((m) => m.grupo))];

  function alternar(m: Modulo, accion: Action) {
    setMarcados((prev) => {
      const s = new Set(prev);
      const permiso = `${m.key}.${accion}`;
      if (s.has(permiso)) {
        s.delete(permiso);
        // Sin "ver" no se puede crear, editar ni eliminar.
        if (accion === "ver") for (const a of m.acciones) s.delete(`${m.key}.${a.key}`);
      } else {
        s.add(permiso);
        s.add(`${m.key}.ver`);
      }
      return s;
    });
  }

  function todos(modo: "todo" | "ver" | "nada") {
    const s = new Set<string>();
    if (modo !== "nada")
      for (const m of modulos) for (const a of m.acciones) if (modo === "todo" || a.key === "ver") s.add(`${m.key}.${a.key}`);
    setMarcados(s);
  }

  const total = modulos.length;
  const conVer = modulos.filter((m) => marcados.has(`${m.key}.ver`)).length;

  return (
    <div>
      <div className="mt-1 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-texto-suave">
          Puede entrar a <strong className="text-texto">{conVer}</strong> de {total} módulos.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => todos("todo")} className={`${clases.botonSecundario} px-3 py-1.5 text-xs`}>
            Marcar todo
          </button>
          <button type="button" onClick={() => todos("ver")} className={`${clases.botonSecundario} px-3 py-1.5 text-xs`}>
            Solo ver todo
          </button>
          <button type="button" onClick={() => todos("nada")} className={`${clases.botonSecundario} px-3 py-1.5 text-xs`}>
            Quitar todo
          </button>
        </div>
      </div>

      {/* Lo que se envía al servidor */}
      {[...marcados].map((p) => (
        <input key={p} type="hidden" name="permisos" value={p} />
      ))}

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {grupos.map((g) => (
          <fieldset key={g}>
            <legend className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-texto-suave uppercase">{g}</legend>
            <ul className="divide-y divide-borde overflow-hidden rounded-xl border border-borde">
              {modulos
                .filter((m) => m.grupo === g)
                .map((m) => (
                  <li key={m.key} className="flex flex-col gap-3 bg-superficie px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <span className="flex items-center gap-3 text-sm font-medium text-texto">
                      <IconoModulo modulo={m.key} className="size-5 shrink-0 text-texto-suave" />
                      {m.label}
                    </span>
                    <span className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
                      {m.acciones.map((a) => (
                        <Interruptor
                          key={a.key}
                          activo={marcados.has(`${m.key}.${a.key}`)}
                          onClick={() => alternar(m, a.key)}
                          etiqueta={a.label}
                          modulo={m.label}
                        />
                      ))}
                    </span>
                  </li>
                ))}
            </ul>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

function Interruptor({ activo, onClick, etiqueta, modulo }: { activo: boolean; onClick: () => void; etiqueta: string; modulo: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={`${modulo}: ${etiqueta}`}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition focus-visible:ring-3 focus-visible:ring-anillo focus-visible:outline-none lg:min-w-[5.75rem] ${
        activo ? "border-primario bg-primario text-primario-texto" : "border-borde-campo bg-superficie text-texto-suave hover:text-texto"
      }`}
    >
      <span
        aria-hidden
        className={`flex size-4 items-center justify-center rounded-full border ${activo ? "border-primario-texto bg-primario-texto text-primario" : "border-borde-campo"}`}
      >
        {activo && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="size-3">
            <path d="m5 12 5 5L20 7" />
          </svg>
        )}
      </span>
      {etiqueta}
    </button>
  );
}
