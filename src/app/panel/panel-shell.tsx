"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconoCerrar, IconoFlecha, IconoGrupo, IconoMenu, IconoModulo, IconoPlegar, IconoSalir } from "@/components/iconos";
import { SelectorTema } from "@/components/selector-tema";
import type { ModuleKey } from "@/lib/permissions";
import { MENU_COOKIE } from "@/lib/tema";

type Item = { key: ModuleKey; label: string; href: string; group: string };
type Grupo = { key: string; label: string; plano: boolean };

/** Lo que se dibuja en el menú: un módulo suelto o una sección con submenú. */
type Entrada = { tipo: "item"; item: Item } | { tipo: "grupo"; grupo: Grupo; items: Item[] };

function armarEntradas(items: Item[], grupos: Grupo[]): Entrada[] {
  return grupos.flatMap((g): Entrada[] => {
    const del = items.filter((i) => i.group === g.key);
    if (del.length === 0) return [];
    // Una sección con un solo módulo visible no necesita submenú.
    if (g.plano || del.length === 1) return del.map((item) => ({ tipo: "item", item }));
    return [{ tipo: "grupo", grupo: g, items: del }];
  });
}

export function PanelShell({
  items,
  grupos,
  user,
  plegadoInicial,
  empresa,
  logout,
  children,
}: {
  items: Item[];
  grupos: Grupo[];
  user: { name: string; role: string };
  plegadoInicial: boolean;
  /** Nombre de la empresa (Administración → Empresa). */
  empresa: string;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  /** Computadora: menú achicado a solo íconos. */
  const [plegado, setPlegado] = useState(plegadoInicial);
  /** Celular: menú abierto encima de la pantalla. */
  const [abierto, setAbierto] = useState(false);
  /** Submenús abiertos o cerrados a mano; si no se tocaron, se abre el que tiene la página actual. */
  const [submenus, setSubmenus] = useState<Record<string, boolean>>({});

  const entradas = armarEntradas(items, grupos);
  const esActivo = (href: string) => (href === "/panel" ? pathname === "/panel" : pathname.startsWith(href));
  const actual = items.find((i) => esActivo(i.href));
  const cerrarMovil = () => setAbierto(false);

  function alternarPlegado() {
    const nuevo = !plegado;
    setPlegado(nuevo);
    // Se guarda en una cookie para que el servidor dibuje el menú igual al recargar (sin saltos).
    document.cookie = `${MENU_COOKIE}=${nuevo ? "plegado" : "abierto"}; path=/; max-age=31536000; samesite=lax`;
  }

  // Celular: con el menú abierto, Esc lo cierra y la página de atrás no se desplaza.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflow;
    };
  }, [abierto]);

  const navCompleta = (
    <ul className="space-y-1">
      {entradas.map((e) => {
        if (e.tipo === "item") {
          const activo = esActivo(e.item.href);
          return (
            <li key={e.item.key}>
              <Link
                href={e.item.href}
                onClick={cerrarMovil}
                aria-current={activo ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] transition ${
                  activo ? "bg-menu-activo font-semibold text-menu-activo-texto shadow-sm" : "text-menu-texto/90 hover:bg-menu-hover hover:text-menu-texto"
                }`}
              >
                <IconoModulo modulo={e.item.key} className="size-5 shrink-0" />
                <span className="truncate">{e.item.label}</span>
              </Link>
            </li>
          );
        }

        const contieneActivo = e.items.some((i) => esActivo(i.href));
        const estaAbierto = submenus[e.grupo.key] ?? contieneActivo;
        const idSub = `submenu-${e.grupo.key}`;
        return (
          <li key={e.grupo.key}>
            <button
              type="button"
              onClick={() => setSubmenus((s) => ({ ...s, [e.grupo.key]: !estaAbierto }))}
              aria-expanded={estaAbierto}
              aria-controls={idSub}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] transition ${
                contieneActivo ? "bg-menu-activo font-semibold text-menu-activo-texto shadow-sm" : "text-menu-texto/90 hover:bg-menu-hover hover:text-menu-texto"
              }`}
            >
              <IconoGrupo grupo={e.grupo.key} className="size-5 shrink-0" />
              <span className="flex-1 truncate">{e.grupo.label}</span>
              <IconoFlecha className={`size-4 shrink-0 transition-transform duration-200 ${estaAbierto ? "rotate-180" : ""}`} />
            </button>
            <ul id={idSub} hidden={!estaAbierto} className="mt-1 mb-1.5 ml-[21px] space-y-0.5 border-l border-menu-borde pl-4">
              {e.items.map((i) => {
                const activo = esActivo(i.href);
                return (
                  <li key={i.key}>
                    <Link
                      href={i.href}
                      onClick={cerrarMovil}
                      aria-current={activo ? "page" : undefined}
                      className={`block truncate rounded-lg px-2.5 py-1.5 text-sm transition ${
                        activo ? "font-semibold text-menu-titulo" : "text-menu-suave hover:bg-menu-hover hover:text-menu-texto"
                      }`}
                    >
                      {i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );

  // Menú achicado: solo íconos; al pasar el mouse (o con el teclado) aparece un panel al costado.
  const navCompacta = (
    <ul className="flex flex-col items-center gap-1.5">
      {entradas.map((e) => {
        const key = e.tipo === "item" ? e.item.key : e.grupo.key;
        const activo = e.tipo === "item" ? esActivo(e.item.href) : e.items.some((i) => esActivo(i.href));
        const claseIcono = `flex size-11 items-center justify-center rounded-xl transition ${
          activo ? "bg-menu-activo text-menu-activo-texto shadow-sm" : "text-menu-texto/85 hover:bg-menu-hover hover:text-menu-texto"
        }`;
        return (
          <li key={key} className="group/flotante relative">
            {e.tipo === "item" ? (
              <Link href={e.item.href} aria-current={activo ? "page" : undefined} aria-label={e.item.label} className={claseIcono}>
                <IconoModulo modulo={e.item.key} className="size-5" />
              </Link>
            ) : (
              <button type="button" aria-label={e.grupo.label} aria-haspopup="true" className={claseIcono}>
                <IconoGrupo grupo={e.grupo.key} className="size-5" />
              </button>
            )}

            {/* pl-5 hace de puente: el mouse pasa del ícono al panel sin que se cierre */}
            <div className="invisible absolute top-0 left-full z-50 pl-5 opacity-0 transition group-focus-within/flotante:visible group-focus-within/flotante:opacity-100 group-hover/flotante:visible group-hover/flotante:opacity-100">
              <div className="min-w-48 rounded-xl bg-menu p-2 shadow-xl shadow-vino-800/10 ring-1 ring-menu-borde">
                {e.tipo === "item" ? (
                  <Link href={e.item.href} tabIndex={-1} className="block rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap text-menu-texto hover:bg-menu-hover">
                    {e.item.label}
                  </Link>
                ) : (
                  <>
                    <p className="px-3 pt-1.5 pb-1 text-sm font-semibold text-menu-texto">{e.grupo.label}</p>
                    <ul>
                      {e.items.map((i) => {
                        const a = esActivo(i.href);
                        return (
                          <li key={i.key}>
                            <Link
                              href={i.href}
                              aria-current={a ? "page" : undefined}
                              className={`block rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition ${
                                a ? "font-semibold text-menu-titulo" : "text-menu-suave hover:bg-menu-hover hover:text-menu-texto"
                              }`}
                            >
                              {i.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );

  const inicial = user.name.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-dvh flex-1">
      {/* Fondo oscuro detrás del menú en celular */}
      <div
        aria-hidden
        onClick={cerrarMovil}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity md:hidden ${
          abierto ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="menu-lateral"
        aria-label="Menú principal"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-[translate,width,visibility] duration-200 ease-out md:visible md:sticky md:top-0 md:z-40 md:h-dvh md:max-w-none md:shrink-0 md:translate-x-0 md:p-3 ${
          abierto ? "visible translate-x-0" : "invisible -translate-x-full"
        } ${plegado ? "md:w-[92px]" : "md:w-[18rem]"}`}
      >
        <div className={`flex h-full flex-col rounded-r-2xl bg-menu text-menu-texto ring-1 ring-menu-borde md:rounded-2xl md:shadow-lg md:shadow-vino-800/5 ${abierto ? "shadow-2xl" : ""}`}>
          {/* Marca y botón para plegar */}
          <div className={`flex shrink-0 items-center gap-3 px-4 pt-4 pb-3 ${plegado ? "md:flex-col md:px-0" : ""}`}>
            <Link href="/panel" onClick={cerrarMovil} className="flex min-w-0 items-center gap-3" title={empresa}>
              {/* eslint-disable-next-line @next/next/no-img-element -- ícono de la marca, cambia desde Ajustes */}
              <img src="/marca/icono-192.png" alt="" width={40} height={40} className="size-10 shrink-0 rounded-full object-cover ring-1 ring-oro-300/60" />
              <span className={`min-w-0 leading-tight ${plegado ? "md:hidden" : ""}`}>
                <span className="font-display block truncate text-lg tracking-wide text-menu-titulo">{empresa}</span>
                <span className="block truncate text-xs text-menu-suave">Gestión de eventos</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={alternarPlegado}
              className={`hidden size-8 shrink-0 items-center justify-center rounded-lg bg-menu-activo text-menu-activo-texto shadow-sm transition hover:opacity-90 focus-visible:ring-3 focus-visible:ring-anillo focus-visible:outline-none md:flex ${
                plegado ? "" : "ml-auto"
              }`}
              aria-label={plegado ? "Mostrar menú completo" : "Achicar menú"}
              aria-controls="menu-lateral"
              aria-expanded={!plegado}
              title={plegado ? "Mostrar menú completo" : "Achicar menú"}
            >
              <IconoPlegar className={`size-4 transition-transform ${plegado ? "rotate-180" : ""}`} />
            </button>
            <button
              type="button"
              onClick={cerrarMovil}
              className="ml-auto flex size-10 items-center justify-center rounded-lg text-menu-suave hover:bg-menu-hover hover:text-menu-texto md:hidden"
              aria-label="Cerrar menú"
            >
              <IconoCerrar />
            </button>
          </div>

          {/* Módulos */}
          <nav
            aria-label="Módulos"
            className={`flex-1 px-3 py-2 ${plegado ? "overflow-y-auto md:overflow-visible" : "barra-fina overflow-y-auto"}`}
            style={{ scrollbarColor: "var(--menu-borde) transparent" }}
          >
            {plegado ? (
              <>
                <div className="md:hidden">{navCompleta}</div>
                <div className="hidden md:block">{navCompacta}</div>
              </>
            ) : (
              navCompleta
            )}
          </nav>

          {/* Usuario, tema y salir */}
          <div className={`shrink-0 space-y-2 border-t border-menu-borde p-3 ${plegado ? "md:flex md:flex-col md:items-center md:space-y-1.5" : ""}`}>
            <div className={`flex items-center gap-3 px-1 py-1 ${plegado ? "md:px-0" : ""}`} title={plegado ? `${user.name} · ${user.role}` : undefined}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-menu-hover text-sm font-semibold text-menu-titulo ring-1 ring-menu-borde" aria-hidden>
                {inicial}
              </span>
              <span className={`min-w-0 ${plegado ? "md:sr-only" : ""}`}>
                <span className="block truncate text-sm font-semibold text-menu-texto">{user.name}</span>
                <span className="block truncate text-xs text-menu-suave">{user.role}</span>
              </span>
            </div>

            {plegado ? (
              <>
                <SelectorTema enMenu compacto className="hidden md:flex" />
                <SelectorTema enMenu className="w-full justify-between md:hidden" />
              </>
            ) : (
              <SelectorTema enMenu className="w-full justify-between" />
            )}

            <form action={logout}>
              <button
                type="submit"
                title={plegado ? "Cerrar sesión" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-menu-texto/90 transition hover:bg-menu-hover hover:text-menu-texto focus-visible:ring-3 focus-visible:ring-anillo focus-visible:outline-none ${
                  plegado ? "md:size-11 md:justify-center md:p-0" : ""
                }`}
              >
                <IconoSalir className="size-5 shrink-0" />
                <span className={plegado ? "md:sr-only" : ""}>Cerrar sesión</span>
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-borde bg-fondo/85 px-4 backdrop-blur md:border-0 md:px-6">
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="flex size-10 items-center justify-center rounded-lg text-texto hover:bg-superficie-2 md:hidden"
            aria-label="Abrir menú"
            aria-controls="menu-lateral"
            aria-expanded={abierto}
          >
            <IconoMenu />
          </button>
          <span className="truncate text-sm font-medium text-texto-suave">{actual?.label ?? empresa}</span>
        </header>

        <main className="min-w-0 flex-1 px-4 pt-2 pb-6 md:px-8 md:pb-8">{children}</main>
      </div>
    </div>
  );
}
