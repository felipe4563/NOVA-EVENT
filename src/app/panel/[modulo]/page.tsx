import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { MODULES, isModuleKey } from "@/lib/permissions";

// Página provisional para los módulos que aún no se construyen.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/panel/[modulo]">): Promise<Metadata> {
  const { modulo } = await params;
  return { title: MODULES.find((m) => m.key === modulo)?.label };
}

export function generateStaticParams() {
  return MODULES.filter((m) => m.key !== "dashboard").map((m) => ({ modulo: m.key }));
}

export default async function ModulePage({ params }: PageProps<"/panel/[modulo]">) {
  const { modulo } = await params;
  if (!isModuleKey(modulo) || modulo === "dashboard") notFound();

  await requirePermission(`${modulo}.ver`);
  const mod = MODULES.find((m) => m.key === modulo)!;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-medium tracking-[0.3em] text-oro-700 uppercase">Módulo</p>
      <h1 className="font-display mt-2 text-3xl text-vino-600">{mod.label}</h1>
      <div className="mt-8 rounded-xl border border-dashed border-rosa-300 bg-white/60 p-8 text-center">
        <p className="font-semibold text-tinta">En construcción</p>
        <p className="mt-1 text-sm text-tinta-suave">Este módulo estará disponible pronto.</p>
      </div>
    </div>
  );
}
