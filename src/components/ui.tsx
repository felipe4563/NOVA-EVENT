import Link from "next/link";
import { IconoAccion } from "./iconos";

/** Clases compartidas para que todas las pantallas se vean igual en modo claro y oscuro. */
export const clases = {
  campo:
    "block w-full rounded-lg border border-borde-campo bg-superficie px-3.5 py-2.5 text-base text-texto shadow-sm outline-none transition placeholder:text-texto-suave/60 focus:border-primario focus:ring-3 focus:ring-anillo disabled:opacity-60 sm:text-sm",
  etiqueta: "block text-sm font-medium text-texto",
  ayuda: "mt-1 text-xs text-texto-suave",
  error: "mt-1 text-xs font-medium text-error",
  botonPrimario:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-primario px-4 py-2.5 text-sm font-semibold text-primario-texto shadow-sm transition hover:bg-primario-hover focus-visible:ring-3 focus-visible:ring-anillo focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
  botonSecundario:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-borde-campo bg-superficie px-4 py-2.5 text-sm font-medium text-texto transition hover:bg-superficie-2 focus-visible:ring-3 focus-visible:ring-anillo focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
  botonPeligro:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-error/40 bg-superficie px-4 py-2.5 text-sm font-medium text-error transition hover:bg-error/10 focus-visible:ring-3 focus-visible:ring-anillo focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
  botonPeligroSolido:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-error px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus-visible:ring-3 focus-visible:ring-anillo focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-carbon",
  tarjeta: "rounded-2xl border border-borde bg-superficie shadow-sm",
};

export function Encabezado({
  seccion,
  titulo,
  descripcion,
  volver,
  children,
}: {
  seccion: string;
  titulo: string;
  descripcion?: string;
  volver?: { href: string; texto: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {volver && (
          <Link href={volver.href} className="mb-3 inline-flex items-center gap-1 text-sm text-enlace hover:text-titulo">
            <IconoAccion accion="volver" /> {volver.texto}
          </Link>
        )}
        <p className="text-xs font-medium tracking-[0.3em] text-acento uppercase">{seccion}</p>
        <h1 className="font-display mt-1.5 text-2xl text-titulo sm:text-3xl">{titulo}</h1>
        {descripcion && <p className="mt-1.5 text-sm text-texto-suave">{descripcion}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </div>
  );
}

const TONOS = {
  neutro: "bg-superficie-2 text-texto-suave ring-borde",
  vino: "bg-activo text-titulo ring-borde-campo/60",
  agua: "bg-agua-100 text-agua-700 ring-agua-300/60 dark:bg-agua-700/25 dark:text-agua-300 dark:ring-agua-700/50",
  oro: "bg-oro-300/25 text-oro-700 ring-oro-300/60 dark:bg-oro-700/25 dark:text-oro-300 dark:ring-oro-700/50",
  error: "bg-error/10 text-error ring-error/30",
} as const;

export function Insignia({ tono = "neutro", children }: { tono?: keyof typeof TONOS; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${TONOS[tono]}`}>
      {children}
    </span>
  );
}

export function Aviso({ tipo = "ok", children }: { tipo?: "ok" | "error"; children: React.ReactNode }) {
  return (
    <div
      role={tipo === "error" ? "alert" : "status"}
      className={`mb-5 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${
        tipo === "ok"
          ? "bg-agua-100 text-agua-700 ring-agua-300/60 dark:bg-agua-700/20 dark:text-agua-300 dark:ring-agua-700/50"
          : "bg-error/10 text-error ring-error/30"
      }`}
    >
      {tipo === "ok" && <IconoAccion accion="check" className="mt-0.5 size-4 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

/** Etiqueta + campo + mensaje de error. */
export function Campo({
  id,
  etiqueta,
  error,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={clases.etiqueta}>
        {etiqueta}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${id}-error`} className={clases.error}>
          {error}
        </p>
      ) : (
        ayuda && <p className={clases.ayuda}>{ayuda}</p>
      )}
    </div>
  );
}

/** Formatea una fecha en la zona horaria del negocio (APP_TIMEZONE). Solo en el servidor. */
export function formatoFecha(fecha: Date | null, conHora = true) {
  if (!fecha) return "Nunca";
  return new Intl.DateTimeFormat("es", {
    timeZone: process.env.APP_TIMEZONE || "America/La_Paz",
    dateStyle: "medium",
    ...(conHora ? { timeStyle: "short" } : {}),
  }).format(fecha);
}
