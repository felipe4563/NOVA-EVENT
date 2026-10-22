/**
 * Catálogo de módulos y permisos del sistema.
 * Cada permiso tiene la forma "<modulo>.<accion>", por ejemplo "contratos.editar".
 * Crear, editar y eliminar incluyen siempre "ver".
 * Los roles guardan qué permisos tienen; el rol administrador tiene acceso total.
 */

/**
 * Secciones del menú lateral, en orden. Una sección con varios módulos se muestra como
 * submenú desplegable; "plano" muestra sus módulos sueltos (sin submenú).
 */
export const GROUPS = [
  { key: "principal", label: "Principal", plano: true },
  { key: "eventos", label: "Eventos", plano: false },
  { key: "proveedores", label: "Proveedores", plano: false },
  { key: "finanzas", label: "Finanzas", plano: false },
  { key: "administracion", label: "Administración", plano: false },
] as const;

export type GroupKey = (typeof GROUPS)[number]["key"];

export const MODULES = [
  { key: "dashboard", label: "Dashboard", href: "/panel", group: "principal" },
  { key: "calendario", label: "Calendario", href: "/panel/calendario", group: "principal" },
  { key: "cotizaciones", label: "Cotizaciones", href: "/panel/cotizaciones", group: "eventos" },
  { key: "cronograma-interno", label: "Cronograma interno", href: "/panel/cronograma-interno", group: "eventos" },
  { key: "cronograma-evento", label: "Cronograma del evento", href: "/panel/cronograma-evento", group: "eventos" },
  { key: "moodboard", label: "Moodboard", href: "/panel/moodboard", group: "eventos" },
  { key: "proveedores", label: "Proveedores", href: "/panel/proveedores", group: "proveedores" },
  { key: "contratos", label: "Contratos", href: "/panel/contratos", group: "finanzas" },
  { key: "saldos", label: "Saldos pendientes", href: "/panel/saldos", group: "finanzas" },
  { key: "usuarios", label: "Usuarios", href: "/panel/usuarios", group: "administracion" },
  { key: "roles", label: "Roles y permisos", href: "/panel/roles", group: "administracion" },
  { key: "empresa", label: "Empresa", href: "/panel/empresa", group: "administracion" },
] as const satisfies readonly { key: string; label: string; href: string; group: GroupKey }[];

export type ModuleKey = (typeof MODULES)[number]["key"];

export const ACTIONS = {
  ver: "Ver",
  crear: "Crear",
  editar: "Editar",
  eliminar: "Eliminar",
} as const;

export type Action = keyof typeof ACTIONS;
export type Permission = `${ModuleKey}.${Action}`;

/** Módulos con acciones limitadas (no tienen nada que crear o eliminar). */
const ACCIONES_LIMITADAS: Partial<Record<ModuleKey, Action[]>> = {
  dashboard: ["ver"],
  empresa: ["ver", "editar"],
};

/** Acciones que aplican a cada módulo. */
export function accionesDe(modulo: ModuleKey): Action[] {
  return ACCIONES_LIMITADAS[modulo] ?? (Object.keys(ACTIONS) as Action[]);
}

export const ALL_PERMISSIONS: Permission[] = MODULES.flatMap((m) => accionesDe(m.key).map((a) => `${m.key}.${a}` as Permission));

/** Módulos con pantallas propias (no usan la página provisional "En construcción"). */
export const MODULOS_CONSTRUIDOS: ModuleKey[] = ["dashboard", "usuarios", "roles", "proveedores", "calendario", "cotizaciones", "empresa", "saldos"];

export const TIPOS_CUENTA = {
  staff: "Equipo Nova Event",
  provider: "Proveedor",
  client: "Cliente",
} as const;

export type TipoCuenta = keyof typeof TIPOS_CUENTA;

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

export function isModuleKey(value: string): value is ModuleKey {
  return MODULES.some((m) => m.key === value);
}

export function hasPermission(
  user: { fullAccess: boolean; permissions: ReadonlySet<string> },
  permission: Permission,
) {
  return user.fullAccess || user.permissions.has(permission);
}
