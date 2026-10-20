"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

type Item = { key: string; label: string; href: string };

export function Sidebar({
  items,
  user,
  logoutSlot,
}: {
  items: Item[];
  user: { name: string; role: string };
  logoutSlot: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/panel" ? pathname === "/panel" : pathname.startsWith(href));

  return (
    <aside className="sticky top-0 z-20 bg-white/90 backdrop-blur md:h-dvh md:w-64 md:shrink-0 md:border-r md:border-marfil">
      <div className="flex h-16 items-center justify-between px-4 md:h-auto md:flex-col md:items-start md:px-5 md:pt-6">
        <Link href="/panel" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <Image src="/icon-192.png" alt="" width={40} height={40} className="rounded-full ring-1 ring-oro-300" />
          <span className="leading-tight">
            <span className="font-display block text-lg tracking-wide text-vino-600">NOVA</span>
            <span className="block text-[10px] tracking-[0.35em] text-oro-700">EVENT</span>
          </span>
        </Link>
        <button
          type="button"
          className="rounded-lg border border-rosa-300 px-3 py-1.5 text-sm text-vino-600 md:hidden"
          aria-expanded={open}
          aria-controls="panel-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Cerrar" : "Menú"}
        </button>
      </div>

      <div
        id="panel-nav"
        className={`${open ? "flex" : "hidden"} max-h-[calc(100dvh-4rem)] flex-col overflow-y-auto border-t border-marfil px-3 pb-4 md:flex md:max-h-none md:h-[calc(100dvh-5.5rem)] md:border-0 md:pt-6`}
      >
        <nav aria-label="Módulos" className="flex-1">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                      active ? "bg-vino-50 font-semibold text-vino-600" : "text-tinta-suave hover:bg-crema hover:text-tinta"
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${active ? "bg-oro-500" : "bg-transparent"}`} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-4 space-y-3 border-t border-marfil pt-4">
          <div className="px-1">
            <p className="truncate text-sm font-semibold text-tinta">{user.name}</p>
            <p className="text-xs text-agua-700">{user.role}</p>
          </div>
          {logoutSlot}
        </div>
      </div>
    </aside>
  );
}
