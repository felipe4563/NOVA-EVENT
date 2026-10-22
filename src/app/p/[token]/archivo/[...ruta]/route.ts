import { esClaveGaleria } from "@/lib/archivos";
import { responderArchivo } from "@/lib/archivos-http";
import { archivosPermitidos } from "@/lib/cotizacion/propuesta";
import { cotizacionCompartida, esArchivoDeGaleria, proveedoresVisiblesDe } from "@/app/panel/cotizaciones/datos";

/**
 * Archivos del enlace público: sin sesión, solo los de la galería de los proveedores que muestra esa propuesta.
 * Todo lo demás responde 404 (nunca 403), para no revelar qué existe.
 */
export async function GET(request: Request, ctx: RouteContext<"/p/[token]/archivo/[...ruta]">) {
  const { token, ruta } = await ctx.params;
  const clave = ruta.join("/");
  const noEncontrado = () => new Response("No encontrado", { status: 404 });
  if (!esClaveGaleria(clave)) return noEncontrado();

  const c = await cotizacionCompartida(token);
  if (!c) return noEncontrado();
  const visibles = await proveedoresVisiblesDe(c);
  if (!archivosPermitidos(visibles, [clave]).has(clave)) return noEncontrado();
  if (!(await esArchivoDeGaleria(clave, visibles))) return noEncontrado();

  return responderArchivo(request, clave);
}
