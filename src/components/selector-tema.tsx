"use client";

import { useEffect, useSyncExternalStore } from "react";
import { TEMA_KEY, type Tema } from "@/lib/tema";

const OPCIONES: { valor: Tema; etiqueta: string; icono: React.ReactNode }[] = [
  { valor: "claro", etiqueta: "Modo claro", icono: <SolIcon /> },
  { valor: "oscuro", etiqueta: "Modo oscuro", icono: <LunaIcon /> },
  { valor: "sistema", etiqueta: "Según el dispositivo", icono: <PantallaIcon /> },
];

const oyentes = new Set<() => void>();
const media = () => matchMedia("(prefers-color-scheme: dark)");

function leerTema(): Tema {
  try {
    const t = localStorage.getItem(TEMA_KEY);
    return t === "claro" || t === "oscuro" ? t : "sistema";
  } catch {
    return "sistema";
  }
}

function aplicarTema(tema: Tema) {
  const oscuro = tema === "oscuro" || (tema === "sistema" && media().matches);
  document.documentElement.setAttribute("data-theme", oscuro ? "dark" : "light");
}

function guardarTema(tema: Tema) {
  try {
    if (tema === "sistema") localStorage.removeItem(TEMA_KEY);
    else localStorage.setItem(TEMA_KEY, tema);
  } catch {
    // Sin almacenamiento (modo privado): el tema vale solo para esta visita.
  }
  aplicarTema(tema);
  oyentes.forEach((avisar) => avisar());
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  // Otra pestaña cambió el tema
  const alGuardar = (e: StorageEvent) => e.key === TEMA_KEY && avisar();
  addEventListener("storage", alGuardar);
  return () => {
    oyentes.delete(avisar);
    removeEventListener("storage", alGuardar);
  };
}

export function SelectorTema({
  className = "",
  compacto = false,
  enMenu = false,
}: {
  className?: string;
  compacto?: boolean;
  /** Colores para ir dentro del menú lateral oscuro. */
  enMenu?: boolean;
}) {
  const c = enMenu
    ? { caja: "border-menu-borde bg-menu-hover/60", activo: "bg-menu-activo text-menu-activo-texto", normal: "text-menu-suave hover:text-menu-texto", suelto: "text-menu-suave hover:bg-menu-hover hover:text-menu-texto" }
    : { caja: "border-borde bg-superficie", activo: "bg-activo text-titulo", normal: "text-texto-suave hover:text-texto", suelto: "text-texto-suave hover:bg-superficie-2 hover:text-texto" };
  // En el servidor no se conoce la preferencia: null = ninguna opción marcada hasta hidratar.
  const tema = useSyncExternalStore<Tema | null>(suscribir, leerTema, () => null);

  // En "sistema", seguir los cambios del dispositivo (por ejemplo, modo oscuro automático de noche).
  // (El tema inicial ya lo puso el script de <head>; aquí no se reaplica para no parpadear al hidratar.)
  useEffect(() => {
    if (tema !== "sistema") return;
    const mq = media();
    const cambio = () => aplicarTema("sistema");
    mq.addEventListener("change", cambio);
    return () => mq.removeEventListener("change", cambio);
  }, [tema]);

  // Un solo botón que va rotando: claro → oscuro → dispositivo (para el menú achicado).
  if (compacto) {
    const i = Math.max(0, OPCIONES.findIndex((o) => o.valor === (tema ?? "sistema")));
    const actual = OPCIONES[i];
    const siguiente = OPCIONES[(i + 1) % OPCIONES.length];
    return (
      <button
        type="button"
        onClick={() => guardarTema(siguiente.valor)}
        aria-label={`Tema: ${actual.etiqueta}. Cambiar a ${siguiente.etiqueta.toLowerCase()}`}
        title={`${actual.etiqueta} (clic para cambiar)`}
        className={`flex size-10 items-center justify-center rounded-lg transition ${c.suelto} focus-visible:ring-3 focus-visible:ring-anillo focus-visible:outline-none ${className}`}
      >
        {actual.icono}
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la pantalla"
      className={`inline-flex items-center gap-0.5 rounded-full border p-0.5 ${c.caja} ${className}`}
    >
      {OPCIONES.map((op) => {
        const activo = tema === op.valor;
        return (
          <button
            key={op.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            aria-label={op.etiqueta}
            title={op.etiqueta}
            onClick={() => guardarTema(op.valor)}
            className={`flex size-9 items-center justify-center rounded-full transition focus-visible:ring-3 focus-visible:ring-anillo focus-visible:outline-none ${
              activo ? c.activo : c.normal
            }`}
          >
            {op.icono}
          </button>
        );
      })}
    </div>
  );
}

const iconoProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "size-[18px]",
  "aria-hidden": true,
};

function SolIcon() {
  return (
    <svg {...iconoProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function LunaIcon() {
  return (
    <svg {...iconoProps}>
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
    </svg>
  );
}

function PantallaIcon() {
  return (
    <svg {...iconoProps}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}
