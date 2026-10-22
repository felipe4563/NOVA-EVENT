import type { ModuleKey } from "@/lib/permissions";

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

type P = { className?: string };

const RUTAS: Record<ModuleKey, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="8" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="15" width="7" height="6" rx="1.5" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18M8 14h2M14 14h2M8 17.5h2" />
    </>
  ),
  cotizaciones: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h7M9 16h4" />
    </>
  ),
  "cronograma-interno": (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" />
    </>
  ),
  "cronograma-evento": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  moodboard: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-9 9" />
    </>
  ),
  proveedores: (
    <>
      <path d="M4 10v10h16V10M3 6l2-3h14l2 3v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  contratos: (
    <>
      <path d="M14 3H6v18h12V7z" />
      <path d="M14 3v4h4M9 17c1.5-2 2.5-2 3 0s1.5 2 3-1" />
    </>
  ),
  saldos: (
    <>
      <path d="M4 7a2 2 0 0 1 2-2h12v4" />
      <path d="M4 7v11a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2z" />
      <circle cx="16" cy="14.5" r="1" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" />
    </>
  ),
  roles: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  empresa: (
    <>
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18" />
      <path d="M8 7h4M8 11h4M8 15h4" />
    </>
  ),
};

/** Íconos de acciones (buscar, agregar, editar...). */
const RUTAS_ACCION = {
  buscar: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  editar: <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4" />,
  llave: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M17 6l3 3M15 8l2 2" />
    </>
  ),
  basura: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  volver: <path d="M15 6l-6 6 6 6" />,
  copiar: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  dado: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1" fill="currentColor" />
      <circle cx="15" cy="15" r="1" fill="currentColor" />
      <circle cx="15" cy="9" r="1" fill="currentColor" />
      <circle cx="9" cy="15" r="1" fill="currentColor" />
    </>
  ),
  check: <path d="m5 12 5 5L20 7" />,
  pausa: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8.5 5 3.5-5 3.5z" />
    </>
  ),
  telefono: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  correo: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  ubicacion: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  enlace: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  etiqueta: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  siguiente: <path d="m9 6 6 6-6 6" />,
  descargar: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  usuario: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
};

export type Accion = keyof typeof RUTAS_ACCION;

export function IconoAccion({ accion, className = "size-4" }: P & { accion: Accion }) {
  return (
    <svg {...base} className={className}>
      {RUTAS_ACCION[accion]}
    </svg>
  );
}

export function IconoModulo({ modulo, className = "size-5" }: P & { modulo: ModuleKey }) {
  return (
    <svg {...base} className={className}>
      {RUTAS[modulo]}
    </svg>
  );
}

export function IconoMenu({ className = "size-5" }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function IconoCerrar({ className = "size-5" }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconoFlecha({ className = "size-4" }: P) {
  return (
    <svg {...base} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconoSalir({ className = "size-5" }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10" />
    </svg>
  );
}

/** Flecha "<" para plegar el menú (girada 180° para desplegar). */
export function IconoPlegar({ className = "size-4" }: P) {
  return (
    <svg {...base} strokeWidth={2.2} className={className}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

const RUTAS_GRUPO: Record<string, React.ReactNode> = {
  eventos: <path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.4 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />,
  finanzas: (
    <>
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7M3 11v4c0 1.7 2.7 3 6 3 1.1 0 2.1-.1 3-.4" />
      <circle cx="17.5" cy="16.5" r="3.5" />
    </>
  ),
  proveedores: RUTAS.proveedores,
  administracion: RUTAS.roles,
};

/** Ícono de una sección del menú con submenú. */
export function IconoGrupo({ grupo, className = "size-5" }: P & { grupo: string }) {
  return (
    <svg {...base} className={className}>
      {RUTAS_GRUPO[grupo] ?? RUTAS.dashboard}
    </svg>
  );
}
