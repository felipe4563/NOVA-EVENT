import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireEquipo } from "@/lib/auth";
import { PropuestaRevista } from "../../_propuesta/propuesta";
import { urlArchivo } from "../../../proveedores/datos";
import { datosPropuesta } from "../../datos";

export const metadata: Metadata = { title: "Presentar propuesta" };
export const instant = false;

/** La propuesta a pantalla completa, para mostrarla a los novios en una reunión (tapa el menú del panel). */
export default async function PresentarPage({ params }: PageProps<"/panel/cotizaciones/[id]/presentar">) {
  await requireEquipo("cotizaciones.ver");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const p = await datosPropuesta(id, (clave) => urlArchivo(clave)!);
  if (!p) notFound();

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-white">
      <a
        href={`/panel/cotizaciones/${id}`}
        className="fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[110] inline-flex items-center gap-1.5 rounded-full bg-carbon/55 px-3.5 py-1.5 text-xs font-medium text-white shadow-md backdrop-blur transition hover:bg-carbon/80 focus-visible:ring-3 focus-visible:ring-oro-300 focus-visible:outline-none"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
        Salir
      </a>
      <PropuestaRevista p={p} />
    </div>
  );
}
