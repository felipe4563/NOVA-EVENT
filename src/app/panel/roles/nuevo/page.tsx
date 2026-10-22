import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { Encabezado } from "@/components/ui";
import { crearRol } from "../actions";
import { modulosMatriz, tiposCuenta } from "../datos";
import { FormularioRol } from "../formulario-rol";

export const metadata: Metadata = { title: "Nuevo rol" };
export const instant = false;

export default async function NuevoRolPage() {
  await requirePermission("roles.crear");
  return (
    <div className="w-full">
      <Encabezado
        seccion="Roles y permisos"
        titulo="Nuevo rol"
        descripcion="Ponle un nombre y elige qué puede ver y hacer en cada módulo."
        volver={{ href: "/panel/roles", texto: "Roles y permisos" }}
      />
      <FormularioRol accion={crearRol} modulos={modulosMatriz} tipos={tiposCuenta} esNuevo />
    </div>
  );
}
