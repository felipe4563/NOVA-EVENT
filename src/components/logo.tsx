/* eslint-disable @next/next/no-img-element -- el logo cambia desde Ajustes de la empresa: se sirve sin optimizar desde /marca */

const ALT = "Nova Event — Tú sueñas, nosotros lo hacemos realidad";

/**
 * Logo completo. Muestra la versión clara o la oscura según el tema.
 * Viene de /marca (el logo subido en Administración → Empresa, o el original de la app).
 * El logo oscuro original trae fondo carbón; mix-blend-lighten lo funde con el fondo de la página.
 */
export function Logo({
  className = "",
  priority = false,
}: {
  className?: string;
  /** Se mantiene por compatibilidad con los llamados existentes. */
  sizes?: string;
  priority?: boolean;
}) {
  const carga = priority ? "eager" : "lazy";
  return (
    <>
      <img src="/marca/logo-claro.webp" alt={ALT} loading={carga} decoding="async" className={`h-auto dark:hidden ${className}`} />
      <img src="/marca/logo-oscuro.webp" alt={ALT} loading={carga} decoding="async" className={`hidden h-auto mix-blend-lighten dark:block ${className}`} />
    </>
  );
}
