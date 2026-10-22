"use client";
/* eslint-disable @next/next/no-img-element -- las imágenes son privadas: se sirven ya optimizadas desde /archivos (o el enlace con token) */

// Partes con interacción de la propuesta. Siempre en colores de marca claros (nunca los del tema del panel).
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { VideoInfo } from "@/lib/videos";
import type { FotoPropuesta } from "./tipos";

// El visor 360° solo se descarga cuando alguien lo abre.
const Visor360 = dynamic(() => import("../../proveedores/_galeria/visor-360").then((m) => m.Visor360), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-sm text-white/80">Cargando visor 360°…</p>,
});

/* ── Pestañas de versiones ("Opción económica / Opción premium") ── */

export function Pestanas({ nombres, children }: { nombres: string[]; children: React.ReactNode[] }) {
  const [activa, setActiva] = useState(0);
  return (
    <div>
      <div className="sticky top-0 z-10 border-y border-oro-300/50 bg-white/90 px-3 py-3 backdrop-blur sm:px-8">
        <div role="tablist" aria-label="Opciones de la propuesta" className="mx-auto flex max-w-3xl gap-2 overflow-x-auto sm:justify-center">
          {nombres.map((n, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              id={`opcion-${i}`}
              aria-selected={activa === i}
              aria-controls={`panel-opcion-${i}`}
              onClick={() => setActiva(i)}
              className={`shrink-0 rounded-full px-5 py-2 font-display text-sm tracking-wide transition focus-visible:ring-3 focus-visible:ring-oro-300 focus-visible:outline-none ${
                activa === i ? "bg-vino-600 text-white shadow-sm" : "border border-oro-300 text-vino-600 hover:bg-vino-50"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      {children.map((panel, i) => (
        <div key={i} role="tabpanel" id={`panel-opcion-${i}`} aria-labelledby={`opcion-${i}`} hidden={activa !== i}>
          {panel}
        </div>
      ))}
    </div>
  );
}

/* ── Diálogo a pantalla completa (fotos y 360°) ──────────────── */

function Pantalla({ titulo, detalle, cerrar, children, onKeyDown }: { titulo: string; detalle?: string; cerrar: () => void; children: React.ReactNode; onKeyDown?: (e: React.KeyboardEvent) => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialogo.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialogo}
      onClose={cerrar}
      onKeyDown={onKeyDown}
      aria-label={titulo}
      className="m-0 size-full max-h-none max-w-none bg-black p-0 text-white [color-scheme:dark] backdrop:bg-black"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-sm tracking-wide">{titulo}</p>
            {detalle && <p className="text-xs text-white/60">{detalle}</p>}
          </div>
          <button type="button" onClick={() => dialogo.current?.close()} className="rounded-full p-2 hover:bg-white/10" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="relative min-h-0 flex-1">{children}</div>
      </div>
    </dialog>
  );
}

/* ── Fotos de la galería (se agrandan al tocarlas) ───────────── */

export function Fotos({ fotos, nombre }: { fotos: FotoPropuesta[]; nombre: string }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const ir = (d: number) => setAbierta((i) => (i === null ? i : (i + d + fotos.length) % fotos.length));
  const f = abierta !== null ? fotos[abierta] : undefined;
  return (
    <>
      <ul className={`grid gap-2 sm:gap-3 ${fotos.length === 1 ? "grid-cols-1" : fotos.length === 2 || fotos.length === 4 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {fotos.map((foto, i) => (
          <li key={foto.src}>
            <button
              type="button"
              onClick={() => setAbierta(i)}
              className="group block w-full overflow-hidden rounded-xl bg-vino-50 focus-visible:ring-3 focus-visible:ring-oro-300 focus-visible:outline-none"
              aria-label={`Ver foto ${i + 1} de ${nombre}`}
            >
              <img src={foto.miniatura} alt={foto.titulo ?? `Foto de ${nombre}`} loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
            </button>
          </li>
        ))}
      </ul>
      {f && abierta !== null && (
        <Pantalla
          titulo={nombre}
          detalle={`${abierta + 1} de ${fotos.length}${f.titulo ? ` · ${f.titulo}` : ""}`}
          cerrar={() => setAbierta(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") ir(1);
            if (e.key === "ArrowLeft") ir(-1);
          }}
        >
          <img key={f.src} src={f.src} alt={f.titulo ?? `Foto de ${nombre}`} className="mx-auto size-full object-contain" />
          {fotos.length > 1 && (
            <>
              <Flecha lado="izquierda" onClick={() => ir(-1)} />
              <Flecha lado="derecha" onClick={() => ir(1)} />
            </>
          )}
        </Pantalla>
      )}
    </>
  );
}

function Flecha({ lado, onClick }: { lado: "izquierda" | "derecha"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={lado === "izquierda" ? "Anterior" : "Siguiente"}
      className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 hover:bg-black/70 ${lado === "izquierda" ? "left-2" : "right-2"}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden>
        <path d={lado === "izquierda" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

const botonMedio =
  "inline-flex items-center justify-center gap-2 rounded-full border border-oro-500 bg-white px-5 py-2.5 text-sm font-semibold text-vino-600 shadow-sm transition hover:bg-vino-50 focus-visible:ring-3 focus-visible:ring-oro-300 focus-visible:outline-none";

/* ── Recorrido 360° ──────────────────────────────────────────── */

export function Boton360({ pano, nombre }: { pano: { src: string; ancho: number; alto: number }; nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={botonMedio}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden>
          <ellipse cx="12" cy="12" rx="9" ry="4" />
          <path d="M12 3a9 9 0 0 1 0 18M12 3a9 9 0 0 0 0 18" strokeOpacity=".6" />
        </svg>
        Recorrer en 360°
      </button>
      {abierto && (
        <Pantalla titulo={nombre} detalle="Arrastra para mirar alrededor" cerrar={() => setAbierto(false)}>
          <Visor360 src={pano.src} ancho={pano.ancho} alto={pano.alto} titulo={nombre} />
        </Pantalla>
      )}
    </>
  );
}

/* ── Video: el reproductor del sitio se carga recién al tocar "play" ── */

export function Video({ video, nombre }: { video: VideoInfo; nombre: string }) {
  const [reproduciendo, setReproduciendo] = useState(false);
  return (
    <div className={`overflow-hidden rounded-xl bg-carbon ${video.vertical ? "mx-auto aspect-[9/16] max-h-[34rem] w-full max-w-[19rem]" : "aspect-video w-full"}`}>
      {reproduciendo ? (
        <iframe
          src={`${video.embed}${video.sitio === "YouTube" ? "&autoplay=1" : ""}`}
          title={`Video de ${nombre}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          className="size-full"
        />
      ) : (
        <button type="button" onClick={() => setReproduciendo(true)} className="group relative block size-full" aria-label={`Reproducir video de ${nombre}`}>
          {video.miniatura ? (
            <img src={video.miniatura} alt="" loading="lazy" className="size-full object-cover opacity-90 transition group-hover:opacity-100" />
          ) : (
            <span className="flex size-full items-center justify-center bg-gradient-to-br from-vino-700 to-carbon text-sm text-white/80">{video.sitio}</span>
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-white/90 text-vino-600 shadow-lg ring-2 ring-oro-300 transition group-hover:scale-110">
              <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 size-7" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
