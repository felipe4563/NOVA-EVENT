import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quotes } from "@/db/schema";
import { cotizacionCompartida } from "@/app/panel/cotizaciones/datos";
import { respuestaPdf } from "@/app/panel/cotizaciones/_propuesta/pdf";
import { datosRecibo } from "@/app/panel/saldos/recibo-datos";
import { documentoRecibo } from "@/app/panel/saldos/recibo-pdf";

/** Recibo del enlace público: token válido y activo, pagos visibles, cobro de esa cotización y no anulado; si no, 404. */
export async function GET(_request: Request, ctx: RouteContext<"/p/[token]/recibo/[codigo]">) {
  const { token, codigo } = await ctx.params;
  const noEncontrado = () => new Response("No encontrado", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const c = await cotizacionCompartida(token);
  if (!c) return noEncontrado();
  const [q] = await db.select({ showPayments: quotes.showPayments }).from(quotes).where(eq(quotes.id, c.id));
  if (!q?.showPayments) return noEncontrado();
  const r = await datosRecibo(c.id, codigo);
  if (!r || r.kind !== "cobro" || r.anulado) return noEncontrado();
  return respuestaPdf(r.codigo, await documentoRecibo(r), "inline");
}
