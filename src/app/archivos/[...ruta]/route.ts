import { esClaveGaleria } from "@/lib/archivos";
import { responderArchivo } from "@/lib/archivos-http";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

/**
 * Entrega los archivos de la galería solo a quien puede verlos:
 * el equipo con «Proveedores: ver» o «Cotizaciones: ver» (para armar y presentar propuestas),
 * o la cuenta del propio proveedor.
 */
export async function GET(request: Request, ctx: RouteContext<"/archivos/[...ruta]">) {
  const { ruta } = await ctx.params;
  const clave = ruta.join("/");
  if (!esClaveGaleria(clave)) return new Response("No encontrado", { status: 404 });

  const yo = await getCurrentUser();
  if (!yo) return new Response("Inicia sesión", { status: 401 });
  const supplierId = ruta[1];
  const puede =
    (yo.role.kind === "staff" && (hasPermission(yo, "proveedores.ver") || hasPermission(yo, "cotizaciones.ver"))) ||
    (yo.role.kind === "provider" && yo.supplierId === supplierId);
  if (!puede) return new Response("Sin permiso", { status: 403 });

  return responderArchivo(request, clave);
}
