/* eslint-disable @next/next/no-img-element -- las imágenes son privadas: se sirven ya optimizadas desde /archivos (o el enlace con token) */
// Propuesta tipo revista que ven los novios: pantalla completa, enlace público y base del PDF.
// Siempre clara: solo colores de marca explícitos (white, carbon, vino, oro, agua), nunca los del tema del panel.
import { estadoPresupuesto } from "@/lib/cotizacion/calculo";
import { formatoBs } from "@/lib/cotizacion/dinero";
import { fechaLarga } from "@/lib/fechas";
import { Boton360, Fotos, Pestanas, Video } from "./interactivo";
import type { LineaPropuesta, Propuesta, TemaNova, VersionPropuesta } from "./tipos";


export function PropuestaRevista({ p }: { p: Propuesta }) {
  const varias = p.versiones.length > 1;
  return (
    <div className="min-h-full bg-marmol-claro p-2 font-sans text-carbon [color-scheme:light] sm:p-5 lg:p-10">
      <article className="mx-auto max-w-5xl overflow-clip rounded-[1.25rem] bg-white shadow-[0_20px_60px_-25px_rgb(70_24_39/0.45)] ring-1 ring-oro-300/70">
        <div className="m-1.5 overflow-clip rounded-2xl border border-oro-300/70 sm:m-3">
          <Portada p={p} />
          {p.versiones.length === 0 ? (
            <p className="px-6 py-16 text-center text-carbon/70">Estamos preparando tu propuesta. Muy pronto podrás verla aquí.</p>
          ) : varias ? (
            <Pestanas nombres={p.versiones.map((v) => v.nombre)}>
              {p.versiones.map((v) => (
                <Version key={v.id} v={v} p={p} />
              ))}
            </Pestanas>
          ) : (
            <Version v={p.versiones[0]} p={p} />
          )}
          <Pie p={p} />
        </div>
      </article>
    </div>
  );
}

/* ── Adornos ─────────────────────────────────────────────────── */

function Ornamento({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 14" className={`mx-auto h-3.5 w-44 text-oro-500 ${className}`} aria-hidden>
      <path d="M0 7h92M128 7h92" stroke="currentColor" strokeWidth="1" />
      <path d="M110 1l6 6-6 6-6-6z" fill="currentColor" />
      <circle cx="98" cy="7" r="1.6" fill="currentColor" />
      <circle cx="122" cy="7" r="1.6" fill="currentColor" />
    </svg>
  );
}

function Rotulo({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[11px] font-semibold tracking-[0.35em] text-oro-700 uppercase ${className}`}>{children}</p>;
}

/* ── 1. Portada ──────────────────────────────────────────────── */

function Portada({ p }: { p: Propuesta }) {
  const datos: [string, string][] = [
    ["Fecha", fechaLarga(p.fecha)],
    ...(p.horario ? ([["Horario", p.horario]] as [string, string][]) : []),
    ...(p.invitados ? ([["Invitados", `${p.invitados} ${p.invitados === 1 ? "persona" : "personas"}`]] as [string, string][]) : []),
  ];
  return (
    <header className="px-5 pt-10 pb-12 text-center sm:px-10 sm:pt-14 sm:pb-16">
      <img
        src="/marca/logo-claro.webp"
        alt={p.empresa.lema ? `${p.empresa.nombre} — ${p.empresa.lema}` : p.empresa.nombre}
        loading="eager"
        className="mx-auto h-auto w-40 sm:w-52"
      />
      <Ornamento className="mt-6" />
      <Rotulo className="mt-6">Propuesta para</Rotulo>
      <h1 className="mt-3 font-display text-3xl leading-tight text-balance break-words text-vino-600 sm:text-5xl">{p.cliente}</h1>
      <p className="mt-3 font-display text-lg tracking-wide text-vino-500 sm:text-xl">{p.tipo}</p>
      <dl className={`mx-auto mt-9 grid max-w-2xl gap-3 ${datos.length === 3 ? "sm:grid-cols-3" : datos.length === 2 ? "sm:grid-cols-2" : ""}`}>
        {datos.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-vino-50/70 px-4 py-3 ring-1 ring-vino-100">
            <dt className="text-[10px] font-semibold tracking-[0.3em] text-oro-700 uppercase">{k}</dt>
            <dd className="mt-1 text-sm font-medium first-letter:uppercase text-carbon">{v}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

/* ── 2–4. Una versión: proveedores, paquete Nova y totales ───── */

function Version({ v, p }: { v: VersionPropuesta; p: Propuesta }) {
  return (
    <div>
      {v.secciones.map((s, i) => (
        <section key={`${s.categoria}-${i}`} className="border-t border-oro-300/40 px-3 py-10 sm:px-8 sm:py-14">
          <div className="mb-7 text-center sm:mb-9">
            <Rotulo>{String(i + 1).padStart(2, "0")}</Rotulo>
            <h2 className="mt-2 font-display text-2xl text-vino-600 sm:text-3xl">{s.categoria}</h2>
            <Ornamento className="mt-3" />
          </div>
          <div className="space-y-6 sm:space-y-8">
            {s.lineas.map((l, j) => (
              <Linea key={j} l={l} />
            ))}
          </div>
        </section>
      ))}
      {v.nova && <PaqueteNova nova={v.nova} />}
      <Totales v={v} p={p} />
    </div>
  );
}

function Linea({ l }: { l: LineaPropuesta }) {
  const nombre = l.proveedor ?? l.etiqueta;
  // La etiqueta de una línea con proveedor es el paquete o un texto propio ("Monto manual" no dice nada a los novios).
  const subtitulo = l.proveedor ? (l.paquete ?? (l.etiqueta !== "Monto manual" && l.etiqueta !== l.proveedor ? l.etiqueta : null)) : null;
  const precio = (
    <div className="shrink-0 sm:text-right">
      <p className="text-[10px] font-semibold tracking-[0.3em] text-oro-700 uppercase">Inversión</p>
      <p className="mt-0.5 font-display text-2xl text-vino-600 tabular-nums">{formatoBs(l.total)}</p>
    </div>
  );

  // Línea libre, sin proveedor ni fotos: renglón sencillo.
  if (!l.proveedor && !l.portada) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-vino-50/60 px-5 py-4 ring-1 ring-vino-100 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-lg break-words text-vino-700">{nombre}</p>
        {precio}
      </div>
    );
  }

  const tieneMedios = l.pano || l.audio || l.video;
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_-18px_rgb(70_24_39/0.5)] ring-1 ring-oro-300/50">
      {l.portada ? (
        <div className="relative aspect-[4/3] bg-vino-50 sm:aspect-[16/8]">
          <img src={l.portada} alt={`Foto de ${nombre}`} className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-carbon/85 via-carbon/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
            <h3 className="font-display text-2xl leading-tight break-words text-white drop-shadow sm:text-4xl">{nombre}</h3>
            {subtitulo && <p className="mt-1 text-sm font-medium tracking-wide text-oro-300 sm:text-base">{subtitulo}</p>}
          </div>
        </div>
      ) : (
        <div className="bg-vino-50/70 px-5 py-6 sm:px-8">
          <h3 className="font-display text-2xl break-words text-vino-600 sm:text-3xl">{nombre}</h3>
          {subtitulo && <p className="mt-1 text-sm font-medium text-oro-700">{subtitulo}</p>}
        </div>
      )}

      <div className="space-y-6 p-5 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          {l.descripcion ? <p className="min-w-0 text-sm leading-relaxed break-words whitespace-pre-line text-carbon/75">{l.descripcion}</p> : <span aria-hidden />}
          {precio}
        </div>

        {l.fotos.length > 0 && <Fotos fotos={l.fotos} nombre={nombre} />}

        {tieneMedios && (
          <div className="space-y-4 border-t border-oro-300/40 pt-5">
            {(l.pano || l.audio) && (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {l.pano && <Boton360 pano={l.pano} nombre={nombre} />}
                {l.audio && (
                  <div className="min-w-0 flex-1">
                    <p className="mb-1.5 text-xs font-semibold tracking-[0.2em] text-oro-700 uppercase">Escucha a {nombre}</p>
                    <audio controls preload="none" src={l.audio} className="w-full">
                      Tu navegador no puede reproducir este audio.
                    </audio>
                  </div>
                )}
              </div>
            )}
            {l.video && <Video video={l.video} nombre={nombre} />}
          </div>
        )}
      </div>
    </article>
  );
}

const TEMA: Record<TemaNova, { tarjeta: string; suave: string; marca: string }> = {
  agua: { tarjeta: "bg-agua-700 text-agua-100", suave: "text-agua-100/80", marca: "text-agua-300" },
  vino: { tarjeta: "bg-vino-600 text-vino-50", suave: "text-vino-50/80", marca: "text-oro-300" },
  oro: { tarjeta: "bg-oro-700 text-oro-300", suave: "text-oro-300/85", marca: "text-white" },
};

function PaqueteNova({ nova }: { nova: NonNullable<VersionPropuesta["nova"]> }) {
  const t = TEMA[nova.theme];
  return (
    <section className="border-t border-oro-300/40 px-3 py-10 sm:px-8 sm:py-14">
      <div className="mb-7 text-center sm:mb-9">
        <Rotulo>Organización</Rotulo>
        <h2 className="mt-2 font-display text-2xl text-vino-600 sm:text-3xl">Paquete Nova Event</h2>
        <Ornamento className="mt-3" />
      </div>
      <div className="rounded-[1.25rem] bg-marmol-claro p-1.5 sm:p-2.5">
        <div className={`rounded-2xl p-6 ring-1 ring-oro-300/70 sm:p-10 ${t.tarjeta}`}>
          <div className="flex flex-col gap-4 border-b border-current/20 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className={`text-[11px] font-semibold tracking-[0.35em] uppercase ${t.marca}`}>Paquete</p>
              <h3 className="mt-1 font-display text-3xl break-words sm:text-4xl">{nova.nombre}</h3>
              {nova.frase && <p className={`mt-2 text-sm italic ${t.suave}`}>{nova.frase}</p>}
            </div>
            <p className="shrink-0 font-display text-3xl tabular-nums sm:text-4xl">{formatoBs(nova.precio)}</p>
          </div>
          {nova.incluye.length > 0 && (
            <>
              <p className={`mt-6 text-xs font-semibold tracking-[0.3em] uppercase ${t.marca}`}>Incluye</p>
              <ul className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                {nova.incluye.map((item, i) => (
                  <li key={i} className="flex gap-2.5">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={`mt-0.5 size-4 shrink-0 ${t.marca}`} aria-hidden>
                      <path d="m4 10.5 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="min-w-0 break-words">{item}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const BARRA = { verde: "bg-agua-500", amarillo: "bg-oro-500", rojo: "bg-vino-500", ninguno: "bg-vino-100" } as const;

function Totales({ v, p }: { v: VersionPropuesta; p: Propuesta }) {
  const t = v.totales;
  const presupuesto = p.mostrarPresupuesto ? p.presupuesto : null;
  const gastado = p.incluyeNovaEnPresupuesto ? t.general : t.proveedores;
  const e = estadoPresupuesto(gastado, presupuesto);
  return (
    <section aria-label="Totales" className="border-t border-oro-300/40 px-3 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-xl rounded-2xl bg-vino-50/60 p-6 ring-1 ring-vino-100 sm:p-8">
        <div className="text-center">
          <Rotulo>Resumen</Rotulo>
          <h2 className="mt-2 font-display text-2xl text-vino-600">Tu inversión</h2>
        </div>
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-carbon/70">Proveedores</dt>
            <dd className="font-medium tabular-nums">{formatoBs(t.proveedores)}</dd>
          </div>
          {v.nova && (
            <div className="flex justify-between gap-3">
              <dt className="text-carbon/70">Paquete Nova Event</dt>
              <dd className="font-medium tabular-nums">{formatoBs(t.nova)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3 border-t border-oro-300/60 pt-4">
            <dt className="font-display text-lg text-vino-700">Total</dt>
            <dd className="font-display text-3xl text-vino-600 tabular-nums">{formatoBs(t.general)}</dd>
          </div>
        </dl>
        {e.tono !== "ninguno" && presupuesto !== null && (
          <div className="mt-6">
            <div
              role="meter"
              aria-label="Presupuesto usado"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(e.porcentaje, 100))}
              aria-valuetext={`${Math.round(e.porcentaje)} % del presupuesto`}
              className="h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-vino-100"
            >
              <div className={`h-full rounded-full ${BARRA[e.tono]}`} style={{ width: `${Math.min(100, Math.max(0, e.porcentaje))}%` }} />
            </div>
            <p className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold text-vino-700">
                {e.restante >= 0 ? `Te quedan ${formatoBs(e.restante)}` : `Supera tu presupuesto por ${formatoBs(-e.restante)}`}
              </span>
              <span className="text-carbon/70">
                {Math.round(e.porcentaje)} % de {formatoBs(presupuesto)}
              </span>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── 5. Pie ──────────────────────────────────────────────────── */

function Pie({ p }: { p: Propuesta }) {
  const e = p.empresa;
  const enlace = "text-vino-600 underline decoration-vino-200 underline-offset-4 hover:text-vino-700";
  const contacto: React.ReactNode[] = [
    e.telefono && (
      <a key="tel" href={e.telefono.enlace} className={enlace}>
        {e.telefono.texto}
      </a>
    ),
    e.correo && (
      <a key="correo" href={`mailto:${e.correo}`} className={`${enlace} break-all`}>
        {e.correo}
      </a>
    ),
    e.web && (
      <a key="web" href={e.web.enlace} target="_blank" rel="noopener noreferrer" className={`${enlace} break-all`}>
        {e.web.texto}
      </a>
    ),
  ].filter(Boolean);
  return (
    <footer className="bg-marmol-claro px-5 py-10 text-center sm:py-12">
      <img src="/marca/logo-claro.webp" alt={e.nombre} loading="lazy" className="mx-auto h-auto w-24 sm:w-28" />
      <p className="mt-4 font-display text-base text-vino-600">
        {e.nombre}
        {e.lema && ` · ${e.lema}`}
      </p>
      {e.whatsapp && (
        <a
          href={e.whatsapp.enlace}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-vino-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-vino-700"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden>
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .3-3.4-.7-2.9-1.2-4.7-4.1-4.9-4.3-.1-.2-1.2-1.6-1.2-3s.8-2.2 1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.2.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.8-.2 1.4Z" />
          </svg>
          Escríbenos por WhatsApp
        </a>
      )}
      {contacto.length > 0 && (
        <p className="mx-auto mt-5 flex max-w-xl flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm text-carbon/80">{contacto}</p>
      )}
      {e.direccion && <p className="mt-2 text-sm text-carbon/70">{e.direccion}</p>}
      {e.redes.length > 0 && (
        <p className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm">
          {e.redes.map((r) => (
            <a key={r.red} href={r.enlace} target="_blank" rel="noopener noreferrer" className={enlace}>
              {r.red} {r.usuario}
            </a>
          ))}
        </p>
      )}
      <Ornamento className="mt-5" />
      {p.validez && <p className="mt-4 text-sm text-carbon/75">Propuesta válida hasta el {fechaLarga(p.validez)}.</p>}
      <p className="mt-2 text-xs tracking-[0.3em] text-carbon/50">{p.codigo}</p>
    </footer>
  );
}
