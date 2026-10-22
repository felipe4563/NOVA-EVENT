import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { respuestaPdf } from "@/app/panel/cotizaciones/_propuesta/pdf";
import { datosRecibo } from "../../../recibo-datos";
import { documentoRecibo } from "../../../recibo-pdf";

/** Recibo en PDF desde el panel: equipo con «Saldos: ver». Los anulados salen con la marca «ANULADO». */
export async function GET(_request: Request, ctx: RouteContext<"/panel/saldos/[id]/recibo/[codigo]">) {
  const yo = await getCurrentUser();
  if (!yo) return new Response("Inicia sesión", { status: 401 });
  if (yo.role.kind !== "staff" || !hasPermission(yo, "saldos.ver")) return new Response("Sin permiso", { status: 403 });

  const { id, codigo } = await ctx.params;
  const noEncontrado = () => new Response("No encontrado", { status: 404 });
  if (!z.uuid().safeParse(id).success) return noEncontrado();
  const r = await datosRecibo(id, codigo);
  if (!r || r.kind !== "cobro") return noEncontrado();
  return respuestaPdf(r.codigo, await documentoRecibo(r), "inline");
}
