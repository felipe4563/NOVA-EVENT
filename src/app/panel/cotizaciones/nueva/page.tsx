import type { Metadata } from "next";
import { requireEquipo } from "@/lib/auth";
import { Encabezado, clases } from "@/components/ui";
import { crearCotizacion } from "../actions";
import { equipoActivo, tiposActivos } from "../datos";
import { FormularioDatos } from "../_armado/formulario-datos";

export const metadata: Metadata = { title: "Nueva cotización" };
export const instant = false;

export default async function NuevaCotizacionPage() {
  const yo = await requireEquipo("cotizaciones.crear");
  const [tipos, equipo] = await Promise.all([tiposActivos(), equipoActivo()]);

  return (
    <div className="w-full">
      <Encabezado
        seccion="Cotizaciones"
        titulo="Nueva cotización"
        descripcion="Primero los datos del evento; después armas las opciones con proveedores."
        volver={{ href: "/panel/cotizaciones", texto: "Cotizaciones" }}
      />
      <section className={`${clases.tarjeta} p-5 sm:p-7`}>
        <FormularioDatos accion={crearCotizacion} tipos={tipos} equipo={equipo} inicial={{ responsable: yo.id }} esNueva />
      </section>
    </div>
  );
}
