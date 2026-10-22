import { ACTIONS, GROUPS, MODULES, TIPOS_CUENTA, accionesDe } from "@/lib/permissions";

/** Módulos para la matriz de permisos, con el nombre de su sección. */
export const modulosMatriz = MODULES.map((m) => ({
  key: m.key,
  label: m.label,
  grupo: GROUPS.find((g) => g.key === m.group)!.label,
  acciones: accionesDe(m.key).map((a) => ({ key: a, label: ACTIONS[a] })),
}));

export const tiposCuenta = Object.entries(TIPOS_CUENTA).map(([valor, etiqueta]) => ({ valor, etiqueta }));
