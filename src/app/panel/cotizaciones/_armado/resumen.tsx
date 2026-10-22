"use client";

import { useState } from "react";
import { clases } from "@/components/ui";
import { estadoPresupuesto } from "@/lib/cotizacion/calculo";
import { formatoBs } from "@/lib/cotizacion/dinero";

export type DatosResumen = {
  version: string;
  proveedores: number;
  nova: number;
  general: number;
  /** Presupuesto del cliente en centavos; null = sin dato. */
  presupuesto: number | null;
  incluyeNova: boolean;
};

const COLOR_BARRA = { verde: "bg-agua-500", amarillo: "bg-oro-500", rojo: "bg-error", ninguno: "bg-borde" } as const;
const COLOR_TEXTO = {
  verde: "text-agua-700 dark:text-agua-300",
  amarillo: "text-oro-700 dark:text-oro-300",
  rojo: "text-error",
  ninguno: "text-texto-suave",
} as const;

function calcular(d: DatosResumen) {
  // Lo que cuenta en la barra depende de la casilla "incluir paquete Nova".
  const gastado = d.incluyeNova ? d.general : d.proveedores;
  return { gastado, ...estadoPresupuesto(gastado, d.presupuesto) };
}

function Barra({ d, compacta = false }: { d: DatosResumen; compacta?: boolean }) {
  const e = calcular(d);
  if (e.tono === "ninguno") return compacta ? null : <p className="text-sm text-texto-suave">Sin presupuesto del cliente: solo se muestra el total.</p>;
  const ancho = Math.min(100, Math.max(0, e.porcentaje));
  // Con <span> para poder ir dentro del botón de la barra del celular.
  return (
    <span className="block">
      <span
        role="meter"
        aria-label="Presupuesto usado"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(e.porcentaje, 100))}
        aria-valuetext={`${Math.round(e.porcentaje)} % del presupuesto`}
        className={`${compacta ? "h-1.5" : "h-2.5"} block overflow-hidden rounded-full bg-superficie-2 ring-1 ring-borde ring-inset`}
      >
        <span className={`block h-full rounded-full transition-[width] duration-300 ${COLOR_BARRA[e.tono]}`} style={{ width: `${ancho}%` }} />
      </span>
      {!compacta && (
        <span className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
          <span className={`font-semibold ${COLOR_TEXTO[e.tono]}`}>
            {e.restante >= 0 ? `Te quedan ${formatoBs(e.restante)}` : `Te pasaste por ${formatoBs(-e.restante)}`}
          </span>
          <span className="text-texto-suave">
            {Math.round(e.porcentaje)} % de {formatoBs(d.presupuesto!)}
          </span>
        </span>
      )}
    </span>
  );
}

function Detalle({ d }: { d: DatosResumen }) {
  return (
    <div className="space-y-4">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-texto-suave">Proveedores</dt>
          <dd className="font-medium text-texto tabular-nums">{formatoBs(d.proveedores)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-texto-suave">Paquete Nova Event</dt>
          <dd className="font-medium text-texto tabular-nums">{formatoBs(d.nova)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-borde pt-2 text-base">
          <dt className="font-semibold text-texto">Total</dt>
          <dd className="font-semibold text-titulo tabular-nums">{formatoBs(d.general)}</dd>
        </div>
      </dl>
      <Barra d={d} />
      {d.presupuesto !== null && (
        <p className="text-xs text-texto-suave">
          {d.incluyeNova ? "La barra cuenta proveedores y el paquete Nova Event." : "La barra cuenta solo a los proveedores."}
        </p>
      )}
    </div>
  );
}

/** Columna lateral en pantallas grandes. */
export function ResumenLateral({ d }: { d: DatosResumen }) {
  return (
    <section aria-label="Resumen" className={`${clases.tarjeta} p-5`}>
      <p className="text-xs font-medium tracking-[0.2em] text-acento uppercase">Resumen</p>
      <h2 className="mt-1 mb-4 truncate font-display text-lg text-titulo">{d.version}</h2>
      <Detalle d={d} />
    </section>
  );
}

/** Barra fija abajo en celular y tableta: total + barra, y se despliega el detalle. */
export function ResumenMovil({ d }: { d: DatosResumen }) {
  const [abierto, setAbierto] = useState(false);
  const e = calcular(d);
  return (
    <section aria-label="Resumen" className="sticky bottom-0 z-20 -mx-4 -mb-6 mt-6 border-t border-borde bg-superficie/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] backdrop-blur md:-mx-8 md:-mb-8 md:px-8 xl:hidden">
      {abierto && (
        <div id="resumen-detalle" className="mb-3 border-b border-borde pb-3">
          <p className="mb-3 truncate text-sm font-semibold text-titulo">{d.version}</p>
          <Detalle d={d} />
        </div>
      )}
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} aria-controls="resumen-detalle" className="flex w-full items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-texto-suave">Total</span>
            {e.tono !== "ninguno" && (
              <span className={`truncate text-xs font-medium ${COLOR_TEXTO[e.tono]}`}>
                {e.restante >= 0 ? `Te quedan ${formatoBs(e.restante)}` : `Te pasaste por ${formatoBs(-e.restante)}`}
              </span>
            )}
          </span>
          <span className="block text-lg font-semibold text-titulo tabular-nums">{formatoBs(d.general)}</span>
          <span className="mt-1 block">
            <Barra d={d} compacta />
          </span>
        </span>
        <span className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-enlace">{abierto ? "Ocultar" : "Detalle"}</span>
      </button>
    </section>
  );
}
