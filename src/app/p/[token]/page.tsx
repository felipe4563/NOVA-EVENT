import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { IconoAccion } from "@/components/iconos";
import { PropuestaRevista } from "@/app/panel/cotizaciones/_propuesta/propuesta";
import { cotizacionCompartida, datosPropuesta } from "@/app/panel/cotizaciones/datos";
import { cuentaPublica } from "@/app/panel/saldos/datos";
import { hoy as hoyFn } from "@/lib/fechas";
import { MisPagos, hayMisPagos } from "./mis-pagos";

// Título neutro (sin el nombre de los clientes) y fuera de los buscadores.
export const metadata: Metadata = {
  title: "Propuesta",
  robots: { index: false, follow: false },
};
// La propuesta es siempre clara: la barra del navegador también, aunque el celular esté en oscuro.
export const viewport: Viewport = { themeColor: "#7a2944" };
export const instant = false;

/** Enlace público de la propuesta: lo abren los novios en su celular, sin cuenta. Siempre muestra el estado actual. */
export default async function PropuestaPublicaPage({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const c = await cotizacionCompartida(token);
  if (!c) notFound();
  // Los archivos se piden por la ruta con token, que solo sirve los de esta propuesta.
  const p = await datosPropuesta(c.id, (clave) => `/p/${token}/archivo/${clave}`);
  if (!p) notFound();

  const hoy = await hoyFn();
  const cuenta = await cuentaPublica(c.id, hoy);
  const misPagos = hayMisPagos(cuenta) ? cuenta : null;

  return (
    <main className="flex-1 bg-marmol-claro [color-scheme:light]">
      {misPagos && (
        <p className="bg-marmol-claro px-4 pt-4 text-center">
          <a href="#mis-pagos" className="text-sm font-semibold text-vino-600 underline decoration-oro-500 underline-offset-4 hover:text-vino-800">
            Ver mis pagos ↓
          </a>
        </p>
      )}
      <PropuestaRevista p={p} />
      {misPagos && <MisPagos c={misPagos} token={token} hoy={hoy} />}
      {/* Para guardarla o reenviarla por WhatsApp. */}
      <div className="bg-marmol-claro px-4 pb-10 text-center">
        <a
          href={`/p/${token}/pdf`}
          download
          className="inline-flex items-center gap-2 rounded-full bg-vino-600 px-6 py-3 text-sm font-semibold tracking-wide text-white shadow-sm ring-1 ring-oro-300/70 transition hover:bg-vino-700 focus-visible:ring-3 focus-visible:ring-oro-500 focus-visible:outline-none"
        >
          <IconoAccion accion="descargar" /> Descargar PDF
        </a>
      </div>
    </main>
  );
}
