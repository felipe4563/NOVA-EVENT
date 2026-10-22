import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { Encabezado, clases } from "@/components/ui";
import { crearUsuario } from "../actions";
import { FormularioUsuario } from "../formulario-usuario";
import { proveedoresParaFormulario, rolesParaFormulario } from "../roles-para-formulario";

export const metadata: Metadata = { title: "Nuevo usuario" };
export const instant = false;

export default async function NuevoUsuarioPage({ searchParams }: PageProps<"/panel/usuarios/nuevo">) {
  await requirePermission("usuarios.crear");
  const [roles, proveedores, sp] = await Promise.all([rolesParaFormulario(), proveedoresParaFormulario(), searchParams]);

  // Desde la ficha de un proveedor: se deja elegido el proveedor y un rol de proveedor.
  const proveedor = proveedores.find((p) => p.id === sp.proveedor);
  const inicial = proveedor ? { proveedor: proveedor.id, rol: roles.find((r) => r.esProveedor)?.id } : undefined;

  return (
    <div className="w-full">
      <Encabezado
        seccion="Usuarios"
        titulo="Nuevo usuario"
        descripcion={proveedor ? `Cuenta para que ${proveedor.name} registre sus días ocupados.` : "Crea la cuenta y entrégale su correo y contraseña."}
        volver={proveedor ? { href: `/panel/proveedores/${proveedor.id}`, texto: proveedor.name } : { href: "/panel/usuarios", texto: "Usuarios" }}
      />
      <section className={`${clases.tarjeta} p-5 sm:p-7`}>
        <FormularioUsuario accion={crearUsuario} roles={roles} proveedores={proveedores} inicial={inicial} esNuevo />
      </section>
    </div>
  );
}
