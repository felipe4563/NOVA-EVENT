import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { quoteItems, quoteVersions, quotes } from "@/db/schema";

/**
 * Días ocupados que creó la confirmación de un proveedor en una cotización: id del día → código (COT-…).
 * Esos días solo se liberan desde la cotización (desconfirmando), nunca desde la agenda.
 */
export async function reservasDe(busyIds: string[]): Promise<Map<string, string>> {
  if (!busyIds.length) return new Map();
  const filas = await db
    .select({ busyId: quoteItems.busyId, code: quotes.code })
    .from(quoteItems)
    .innerJoin(quoteVersions, eq(quoteItems.versionId, quoteVersions.id))
    .innerJoin(quotes, eq(quoteVersions.quoteId, quotes.id))
    .where(inArray(quoteItems.busyId, busyIds));
  return new Map(filas.flatMap((f) => (f.busyId ? [[f.busyId, f.code] as const] : [])));
}
