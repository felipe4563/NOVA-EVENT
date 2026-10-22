"use client";

import { useRouter } from "next/navigation";
import { useActionState, useId, useRef, useState } from "react";
import { IconoAccion } from "@/components/iconos";
import { clases } from "@/components/ui";
import { agregarVideo } from "../galeria-actions";
import { TIPOS, type Tipo } from "./tipos";

type Envio = { nombre: string; avance: number; estado: "espera" | "subiendo" | "listo" | "error"; error?: string };

/** Sube un archivo mostrando el avance (fetch no informa el avance de subida; XMLHttpRequest sí). */
function subirUno(url: string, datos: FormData, alAvanzar: (p: number) => void) {
  return new Promise<{ ok: boolean; error?: string }>((resolver) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && alAvanzar(e.loaded / e.total);
    xhr.onload = () => {
      let r: { ok?: boolean; error?: string } = {};
      try {
        r = JSON.parse(xhr.responseText);
      } catch {}
      resolver(xhr.status < 300 && r.ok ? { ok: true } : { ok: false, error: r.error ?? "No se pudo subir." });
    };
    xhr.onerror = () => resolver({ ok: false, error: "Sin conexión. Revisa tu internet e intenta de nuevo." });
    xhr.send(datos);
  });
}

export function SubirArchivos({ supplierId, tipo, albumes }: { supplierId: string; tipo: Exclude<Tipo, "video">; albumes: string[] }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const idLista = useId();
  const [album, setAlbum] = useState("");
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const ocupado = envios.some((e) => e.estado === "espera" || e.estado === "subiendo");
  const t = TIPOS[tipo];

  async function subir(archivos: File[]) {
    if (!archivos.length || ocupado) return;
    setEnvios(archivos.map((a) => ({ nombre: a.name, avance: 0, estado: "espera" })));
    const cambiar = (i: number, c: Partial<Envio>) => setEnvios((l) => l.map((e, j) => (j === i ? { ...e, ...c } : e)));

    // De a uno: así no se satura la conexión del celular.
    for (const [i, archivo] of archivos.entries()) {
      cambiar(i, { estado: "subiendo" });
      const datos = new FormData();
      datos.set("tipo", tipo);
      datos.set("album", album);
      datos.set("archivo", archivo);
      const r = await subirUno(`/api/proveedores/${supplierId}/galeria`, datos, (p) => cambiar(i, { avance: p }));
      cambiar(i, r.ok ? { estado: "listo", avance: 1 } : { estado: "error", error: r.error });
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          subir([...e.dataTransfer.files]);
        }}
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          arrastrando ? "border-primario bg-activo" : "border-borde-campo bg-superficie-2/40"
        }`}
      >
        <IconoAccion accion="mas" className="size-6 text-acento" />
        <p className="text-sm font-medium text-texto">Arrastra aquí {t.plural.toLowerCase()} o</p>
        <button type="button" onClick={() => entrada.current?.click()} disabled={ocupado} className={`${clases.botonPrimario} px-3 py-2 text-xs`}>
          Elegir {t.plural.toLowerCase()}
        </button>
        <p className="text-xs text-texto-suave">{t.ayuda}</p>
        <input
          ref={entrada}
          type="file"
          multiple
          accept={t.accept}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            subir([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idLista}-album`} className="shrink-0 text-xs font-medium text-texto-suave">
          Álbum o estilo (opcional)
        </label>
        <input
          id={`${idLista}-album`}
          list={idLista}
          value={album}
          onChange={(e) => setAlbum(e.target.value)}
          maxLength={60}
          placeholder={t.ejemploAlbum}
          className={`${clases.campo} py-2`}
        />
        <datalist id={idLista}>
          {albumes.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </div>

      {envios.length > 0 && (
        <ul className="space-y-1.5" aria-live="polite">
          {envios.map((e, i) => (
            <li key={i} className="rounded-lg bg-superficie-2/60 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-texto">{e.nombre}</span>
                <span className={e.estado === "error" ? "text-error" : e.estado === "listo" ? "text-agua-700 dark:text-agua-300" : "text-texto-suave"}>
                  {e.estado === "espera" ? "En espera" : e.estado === "subiendo" ? `${Math.round(e.avance * 100)} %` : e.estado === "listo" ? "Listo ✓" : "Error"}
                </span>
              </div>
              {e.estado === "subiendo" && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-borde">
                  <div className="h-full bg-primario transition-[width]" style={{ width: `${e.avance * 100}%` }} />
                </div>
              )}
              {e.error && <p className="mt-1 text-error">{e.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AgregarVideo({ supplierId, albumes }: { supplierId: string; albumes: string[] }) {
  const [estado, enviar, pendiente] = useActionState(agregarVideo.bind(null, supplierId), undefined);
  const idLista = useId();
  const v = estado?.valores ?? {};
  return (
    <form action={enviar} noValidate key={JSON.stringify(estado ?? null)} className="space-y-3">
      <div>
        <label htmlFor={`${idLista}-url`} className={clases.etiqueta}>
          Enlace del video
        </label>
        <input
          id={`${idLista}-url`}
          name="url"
          type="url"
          inputMode="url"
          defaultValue={v.url}
          required
          placeholder="https://www.youtube.com/watch?v=…"
          className={`${clases.campo} mt-1.5`}
        />
        <p className={clases.ayuda}>YouTube, Vimeo, TikTok o Instagram. El video no se sube: se ve con el reproductor de ese sitio.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="titulo" defaultValue={v.titulo} maxLength={120} placeholder="Título (opcional)" aria-label="Título" className={clases.campo} />
        <input name="album" list={idLista} defaultValue={v.album} maxLength={60} placeholder="Álbum (opcional)" aria-label="Álbum" className={clases.campo} />
        <datalist id={idLista}>
          {albumes.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </div>
      {estado?.error && <p className={clases.error}>{estado.error}</p>}
      {estado?.ok && <p className="text-xs font-medium text-agua-700 dark:text-agua-300">{estado.ok}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={pendiente} className={clases.botonPrimario}>
          <IconoAccion accion="mas" /> {pendiente ? "Agregando…" : "Agregar video"}
        </button>
      </div>
    </form>
  );
}
