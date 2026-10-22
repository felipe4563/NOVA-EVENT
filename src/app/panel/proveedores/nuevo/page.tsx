import type { Metadata } from "next";
import { requireEquipo } from "@/lib/auth";
import { Encabezado, clases } from "@/components/ui";
import { crearProveedor } from "../actions";
import { categoriasOrdenadas } from "../datos";
import { FormularioProveedor } from "../formulario-proveedor";

export const metadata: Metadata = { title: "Nuevo proveedor" };
export const instant = false;

export default async function NuevoProveedorPage() {
  await requireEquipo("proveedores.crear");
  const categorias = await categoriasOrdenadas();

  return (
    <div className="w-full">
      <Encabezado
        seccion="Proveedores"
        titulo="Nuevo proveedor"
        descripcion="Después podrás darle acceso al sistema para que registre sus días ocupados."
        volver={{ href: "/panel/proveedores", texto: "Proveedores" }}
      />
      <section className={`${clases.tarjeta} p-5 sm:p-7`}>
        <FormularioProveedor accion={crearProveedor} categorias={categorias} esNuevo />
      </section>
    </div>
  );
}
