import { leerArchivo, rutaSegura } from "@/lib/archivos";
import { archivosPermitidos } from "@/lib/cotizacion/propuesta";
import { origenDe } from "@/lib/origen";
import { cotizacionCompartida, datosPropuesta, esArchivoDeGaleria, proveedoresVisiblesDe } from "@/app/panel/cotizaciones/datos";
import { documentoPropuesta, respuestaPdf } from "@/app/panel/cotizaciones/_propuesta/pdf";

/** PDF del enlace público: sin sesión, mismas reglas que la página (token válido y activo; si no, 404). */
export async function GET(request: Request, ctx: RouteContext<"/p/[token]/pdf">) {
  const { token } = await ctx.params;
  const noEncontrado = () => new Response("No encontrado", { status: 404 });
  const c = await cotizacionCompartida(token);
  if (!c) return noEncontrado();
  const p = await datosPropuesta(c.id, (clave) => clave);
  if (!p) return noEncontrado();

  // Imágenes solo con la misma lista permitida que la ruta de archivos del enlace.
  const visibles = await proveedoresVisiblesDe(c);
  const leerImagen = async (clave: string) =>
    rutaSegura(clave) && archivosPermitidos(visibles, [clave]).has(clave) && (await esArchivoDeGaleria(clave, visibles)) ? leerArchivo(clave) : null;

  return respuestaPdf(p.codigo, await documentoPropuesta(p, leerImagen, `${origenDe(request.headers)}/p/${token}`));
}
