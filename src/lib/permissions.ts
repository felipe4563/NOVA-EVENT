/**
 * Catálogo de módulos y permisos del sistema.
 * Cada permiso tiene la forma "<modulo>.<accion>", por ejemplo "contratos.gestionar".
 * Los roles guardan qué permisos tienen; el rol administrador tiene acceso total.
 */

export const MODULES = [
  { key: "dashboard", label: "Dashboard", href: "/panel" },
  { key: "cotizaciones", label: "Cotizaciones", href: "/panel/cotizaciones" },
  { key: "proveedores", label: "Proveedores", href: "/panel/proveedores" },
  { key: "cronograma-interno", label: "Cronograma interno", href: "/panel/cronograma-interno" },
  { key: "cronograma-evento", label: "Cronograma del evento", href: "/panel/cronograma-evento" },
  { key: "contratos", label: "Contratos", href: "/panel/contratos" },
  { key: "saldos", label: "Saldos pendientes", href: "/panel/saldos" },
  { key: "moodboard", label: "Moodboard", href: "/panel/moodboard" },
  { key: "calendario", label: "Calendario", href: "/panel/calendario" },
  { key: "usuarios", label: "Usuarios y roles", href: "/panel/usuarios" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

export const ACTIONS = {
  ver: "Ver",
  gestionar: "Crear y editar",
} as const;

export type Action = keyof typeof ACTIONS;
export type Permission = `${ModuleKey}.${Action}`;

export const ALL_PERMISSIONS: Permission[] = MODULES.flatMap((m) =>
  (Object.keys(ACTIONS) as Action[]).map((a) => `${m.key}.${a}` as Permission),
);

export function isModuleKey(value: string): value is ModuleKey {
  return MODULES.some((m) => m.key === value);
}

export function hasPermission(
  user: { fullAccess: boolean; permissions: ReadonlySet<string> },
  permission: Permission,
) {
  return user.fullAccess || user.permissions.has(permission);
}
