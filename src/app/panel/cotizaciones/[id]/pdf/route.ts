import { z } from "zod";
import { leerArchivo } from "@/lib/archivos";
import { getCurrentUser } from "@/lib/auth";
import { origenDe } from "@/lib/origen";
import { hasPermission } from "@/lib/permissions";
import { cargarCotizacion, datosPropuesta } from "../../datos";
import { documentoPropuesta, respuestaPdf } from "../../_propuesta/pdf";

/** PDF de la propuesta desde el panel: equipo con «Cotizaciones: ver». El QR apunta al enlace público si está activo. */
export async function GET(request: Request, ctx: RouteContext<"/panel/cotizaciones/[id]/pdf">) {
  const yo = await getCurrentUser();
  if (!yo) return new Response("Inicia sesión", { status: 401 });
  if (yo.role.kind !== "staff" || !hasPermission(yo, "cotizaciones.ver")) return new Response("Sin permiso", { status: 403 });

  const { id } = await ctx.params;
  const noEncontrado = () => new Response("No encontrado", { status: 404 });
  if (!z.uuid().safeParse(id).success) return noEncontrado();
  const datos = await cargarCotizacion(id);
  if (!datos) return noEncontrado();
  // Las direcciones de archivo son las claves mismas: el PDF las lee del disco.
  const p = await datosPropuesta(id, (clave) => clave);
  if (!p) return noEncontrado();

  const { shareEnabled, shareToken } = datos.cotizacion;
  const enlace = shareEnabled && shareToken ? `${origenDe(request.headers)}/p/${shareToken}` : null;
  return respuestaPdf(p.codigo, await documentoPropuesta(p, leerArchivo, enlace));
}
