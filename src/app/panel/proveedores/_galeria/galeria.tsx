"use client";
/* eslint-disable @next/next/no-img-element -- las imágenes son privadas (piden sesión): se sirven ya optimizadas desde /archivos */

import dynamic from "next/dynamic";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { BotonConfirmar } from "@/components/boton-confirmar";
import { IconoAccion, IconoCerrar } from "@/components/iconos";
import { clases } from "@/components/ui";
import { editarMedia, eliminarMedia, marcarPortada } from "../galeria-actions";
import { AgregarVideo, SubirArchivos } from "./subir";
import { TIPOS, type ItemGaleria, type Tipo } from "./tipos";

// El visor 360° solo se carga cuando alguien abre una foto 360°.
const Visor360 = dynamic(() => import("./visor-360").then((m) => m.Visor360), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-sm text-white/80">Cargando visor 360°…</p>,
});

const ORDEN: Tipo[] = ["photo", "plan", "pano", "audio", "video"];

export function Galeria({ items, editable, supplierId }: { items: ItemGaleria[]; editable: boolean; supplierId: string }) {
  const conteo = Object.fromEntries(ORDEN.map((t) => [t, items.filter((i) => i.kind === t).length])) as Record<Tipo, number>;
  // Quien edita ve todas las pestañas (para subir); quien solo mira, las que tienen algo.
  const pestanas = editable ? ORDEN : ORDEN.filter((t) => conteo[t] > 0);
  const [tipo, setTipo] = useState<Tipo>(pestanas.find((t) => conteo[t] > 0) ?? "photo");
  const [album, setAlbum] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<number | null>(null);

  const delTipo = items.filter((i) => i.kind === tipo);
  const albumes = [...new Set(delTipo.map((i) => i.album).filter((a): a is string => Boolean(a)))].sort();
  const todosLosAlbumes = [...new Set(items.map((i) => i.album).filter((a): a is string => Boolean(a)))].sort();
  const visibles = album ? delTipo.filter((i) => i.album === album) : delTipo;

  if (!pestanas.length) {
    return <p className="rounded-xl bg-superficie-2/60 px-4 py-6 text-center text-sm text-texto-suave">Este proveedor todavía no tiene fotos, audios ni videos.</p>;
  }

  return (
    <div>
      {/* Pestañas por tipo */}
      <div role="tablist" aria-label="Tipo de contenido" className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 barra-fina">
        {pestanas.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tipo === t}
            onClick={() => {
              setTipo(t);
              setAlbum(null);
            }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              tipo === t ? "bg-primario text-primario-texto" : "bg-superficie-2 text-texto-suave hover:text-texto"
            }`}
          >
            {TIPOS[t].plural} <span className="opacity-70">({conteo[t]})</span>
          </button>
        ))}
      </div>

      {albumes.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Álbumes">
          {[null, ...albumes].map((a) => (
            <button
              key={a ?? "todos"}
              type="button"
              aria-pressed={album === a}
              onClick={() => setAlbum(a)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                album === a ? "border-primario bg-activo text-titulo" : "border-borde text-texto-suave hover:text-texto"
              }`}
            >
              {a ?? "Todos"}
            </button>
          ))}
        </div>
      )}

      <div className={`grid items-start gap-5 ${editable ? "xl:grid-cols-[minmax(0,1fr)_20rem]" : ""}`}>
        <div role="tabpanel">
          {visibles.length === 0 ? (
            <p className="rounded-xl bg-superficie-2/60 px-4 py-8 text-center text-sm text-texto-suave">
              {TIPOS[tipo].vacio}
              {editable && " Agrégalos desde el panel de la derecha."}
            </p>
          ) : tipo === "audio" ? (
            <ListaAudios items={visibles} editable={editable} />
          ) : tipo === "video" ? (
            <ListaVideos items={visibles} editable={editable} />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
              {visibles.map((m, i) => (
                <li key={m.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => setAbierto(i)}
                    className="block w-full overflow-hidden rounded-xl bg-superficie-2 focus-visible:ring-3 focus-visible:ring-anillo focus-visible:outline-none"
                  >
                    <img
                      src={m.thumb ?? ""}
                      alt={m.title ?? TIPOS[m.kind].plural}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                    {m.kind === "pano" && (
                      <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">360°</span>
                    )}
                    {m.isCover && <span className="absolute top-2 left-2 rounded-full bg-primario px-2 py-0.5 text-[11px] font-semibold text-primario-texto">Portada</span>}
                  </button>
                  <div className="mt-1.5 flex items-start justify-between gap-1">
                    <p className="min-w-0 truncate text-xs text-texto-suave" title={m.title ?? undefined}>
                      {m.title}
                    </p>
                    {editable && <Acciones item={m} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {editable && (
          <aside className="rounded-xl border border-borde p-4 xl:sticky xl:top-4">
            <h3 className="mb-3 text-sm font-semibold text-texto">Agregar {TIPOS[tipo].plural.toLowerCase()}</h3>
            {tipo === "video" ? (
              <AgregarVideo supplierId={supplierId} albumes={todosLosAlbumes} />
            ) : (
              <SubirArchivos key={tipo} supplierId={supplierId} tipo={tipo} albumes={todosLosAlbumes} />
            )}
          </aside>
        )}
      </div>

      {abierto !== null && visibles[abierto] && (
        <Visor items={visibles} indice={abierto} setIndice={setAbierto} cerrar={() => setAbierto(null)} />
      )}
    </div>
  );
}

/* ── Visor a pantalla completa (fotos, planos y 360°) ─────────── */

function Visor({ items, indice, setIndice, cerrar }: { items: ItemGaleria[]; indice: number; setIndice: (i: number) => void; cerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const m = items[indice];
  const hay = items.length > 1;
  const ir = (d: number) => setIndice((indice + d + items.length) % items.length);

  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogo}
      onClose={cerrar}
      onKeyDown={(e) => {
        // En 360° las flechas mueven la vista, no cambian de foto.
        if (m.kind === "pano") return;
        if (e.key === "ArrowRight") ir(1);
        if (e.key === "ArrowLeft") ir(-1);
      }}
      aria-label={m.title ?? "Foto"}
      className="m-0 size-full max-h-none max-w-none bg-black p-0 text-white backdrop:bg-black"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{m.title}</p>
            <p className="text-xs text-white/60">
              {m.album ? `${m.album} · ` : ""}
              {indice + 1} de {items.length}
              {m.kind === "pano" && " · Arrastra para mirar alrededor"}
            </p>
          </div>
          <button type="button" onClick={() => dialogo.current?.close()} className="rounded-full p-2 hover:bg-white/10" aria-label="Cerrar">
            <IconoCerrar />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          {m.kind === "pano" ? (
            <Visor360 key={m.id} src={m.src!} ancho={m.width ?? 2} alto={m.height ?? 1} titulo={m.title ?? ""} />
          ) : (
            <img key={m.id} src={m.src ?? ""} alt={m.title ?? ""} className={`mx-auto size-full object-contain ${m.kind === "plan" ? "bg-white" : ""}`} />
          )}
          {hay && (
            <>
              <button
                type="button"
                onClick={() => ir(-1)}
                className="absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 hover:bg-black/70"
                aria-label="Anterior"
              >
                <IconoAccion accion="volver" className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => ir(1)}
                className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 hover:bg-black/70"
                aria-label="Siguiente"
              >
                <IconoAccion accion="siguiente" className="size-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

/* ── Audios y videos ──────────────────────────────────────────── */

function ListaAudios({ items, editable }: { items: ItemGaleria[]; editable: boolean }) {
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {items.map((m) => (
        <li key={m.id} className="rounded-xl border border-borde bg-superficie-2/60 p-3">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-texto">{m.title ?? "Audio"}</p>
              {m.album && <p className="text-xs text-texto-suave">{m.album}</p>}
            </div>
            {editable && <Acciones item={m} />}
          </div>
          <audio controls preload="none" src={m.src ?? undefined} className="w-full">
            Tu navegador no puede reproducir este audio.
          </audio>
        </li>
      ))}
    </ul>
  );
}

function ListaVideos({ items, editable }: { items: ItemGaleria[]; editable: boolean }) {
  const [reproduciendo, setReproduciendo] = useState<string | null>(null);
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((m) => {
        const v = m.video;
        return (
          <li key={m.id}>
            <div className={`overflow-hidden rounded-xl bg-black ${v?.vertical ? "mx-auto aspect-[9/16] max-h-[32rem]" : "aspect-video"}`}>
              {!v ? (
                <a href={m.url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex size-full items-center justify-center text-sm text-white underline">
                  Abrir video
                </a>
              ) : reproduciendo === m.id ? (
                <iframe
                  src={`${v.embed}${v.sitio === "YouTube" ? "&autoplay=1" : ""}`}
                  title={m.title ?? "Video"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="size-full"
                />
              ) : (
                // El reproductor del sitio se carga recién al tocar "play": la página no se pone lenta.
                <button type="button" onClick={() => setReproduciendo(m.id)} className="group relative block size-full" aria-label={`Reproducir ${m.title ?? "video"}`}>
                  {v.miniatura ? (
                    <img src={v.miniatura} alt="" loading="lazy" className="size-full object-cover opacity-90 transition group-hover:opacity-100" />
                  ) : (
                    <span className="flex size-full items-center justify-center bg-gradient-to-br from-vino-700 to-carbon text-sm text-white/80">{v.sitio}</span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex size-14 items-center justify-center rounded-full bg-black/60 text-white transition group-hover:scale-110">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 size-7" aria-hidden>
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </span>
                </button>
              )}
            </div>
            <div className="mt-1.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-texto">{m.title}</p>
                <p className="text-xs text-texto-suave">
                  {v?.sitio ?? "Enlace"}
                  {m.album ? ` · ${m.album}` : ""}
                </p>
              </div>
              {editable && <Acciones item={m} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Editar, portada y eliminar ───────────────────────────────── */

function Acciones({ item }: { item: ItemGaleria }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [pendiente, iniciar] = useTransition();
  const [estado, enviar, guardando] = useActionState(editarMedia.bind(null, item.id), undefined);
  useEffect(() => {
    if (estado?.ok) dialogo.current?.close();
  }, [estado]);
  const boton = "rounded-md p-1.5 text-texto-suave transition hover:bg-superficie-2 hover:text-texto";

  return (
    <div className="flex shrink-0 items-center">
      <button type="button" onClick={() => dialogo.current?.showModal()} className={boton} title="Editar título y álbum" aria-label="Editar título y álbum">
        <IconoAccion accion="editar" className="size-3.5" />
      </button>
      {item.kind === "photo" && !item.isCover && (
        <button
          type="button"
          disabled={pendiente}
          onClick={() => iniciar(async () => void (await marcarPortada(item.id)))}
          className={boton}
          title="Usar como portada"
          aria-label="Usar como portada"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-3.5" aria-hidden>
            <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
          </svg>
        </button>
      )}
      <BotonConfirmar
        accion={eliminarMedia.bind(null, item.id)}
        titulo="¿Eliminar este archivo?"
        mensaje={`«${item.title ?? "Sin título"}» se borra para siempre.`}
        textoConfirmar="Eliminar"
        peligro
        className={`${boton} hover:text-error`}
      >
        <IconoAccion accion="basura" className="size-3.5" />
        <span className="sr-only">Eliminar</span>
      </BotonConfirmar>

      <dialog
        ref={dialogo}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-borde bg-superficie p-0 text-texto shadow-2xl backdrop:bg-black/40"
      >
        <form action={enviar} noValidate key={JSON.stringify(estado ?? null)} className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-titulo">Editar</h2>
          <label className="block">
            <span className={clases.etiqueta}>Título</span>
            <input name="titulo" defaultValue={estado?.valores?.titulo ?? item.title ?? ""} maxLength={120} className={`${clases.campo} mt-1.5`} />
          </label>
          <label className="block">
            <span className={clases.etiqueta}>Álbum o estilo</span>
            <input name="album" defaultValue={estado?.valores?.album ?? item.album ?? ""} maxLength={60} className={`${clases.campo} mt-1.5`} />
          </label>
          {estado?.error && <p className={clases.error}>{estado.error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => dialogo.current?.close()} className={clases.botonSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className={clases.botonPrimario}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
