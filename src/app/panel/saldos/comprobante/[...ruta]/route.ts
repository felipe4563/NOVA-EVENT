import { eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentMovements } from "@/db/schema";
import { rutaSegura } from "@/lib/archivos";
import { responderArchivo } from "@/lib/archivos-http";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

/**
 * Comprobantes de pago: solo para el equipo con «Saldos: ver».
 * La galería (/archivos) nunca los entrega; aquí solo se sirven claves pagos/… que pertenecen a un movimiento.
 */
export async function GET(request: Request, ctx: RouteContext<"/panel/saldos/comprobante/[...ruta]">) {
  const { ruta } = await ctx.params;
  const clave = ruta.join("/");
  if (!clave.startsWith("pagos/") || !rutaSegura(clave)) return new Response("No encontrado", { status: 404 });

  const yo = await getCurrentUser();
  if (!yo) return new Response("Inicia sesión", { status: 401 });
  if (yo.role.kind !== "staff" || !hasPermission(yo, "saldos.ver")) return new Response("Sin permiso", { status: 403 });

  const [m] = await db.select({ id: paymentMovements.id }).from(paymentMovements).where(eq(paymentMovements.fileKey, clave)).limit(1);
  if (!m) return new Response("No encontrado", { status: 404 });

  return responderArchivo(request, clave);
}
