import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { paymentMovements, users } from "@/db/schema";
import { contactoEmpresa, datosEmpresa } from "@/lib/empresa";
import { fechaLarga, hoy } from "@/lib/fechas";
import { ETIQUETA_FORMA, saldoAlRecibo } from "@/lib/saldos/recibo";
import { cuentaEvento } from "./datos";
import type { DatosRecibo } from "./recibo-pdf";

/** Datos de un recibo de esa cotización; null si el código no existe o es de otra. `kind` lo usa la ruta pública. */
export async function datosRecibo(quoteId: string, codigo: string): Promise<(DatosRecibo & { kind: (typeof paymentMovements.$inferSelect)["kind"] }) | null> {
  const [fila] = await db
    .select({ m: paymentMovements, recibidoPor: users.name })
    .from(paymentMovements)
    .leftJoin(users, eq(paymentMovements.handledById, users.id))
    .where(and(eq(paymentMovements.quoteId, quoteId), eq(paymentMovements.receiptCode, codigo)));
  if (!fila || fila.m.receiptSeq === null) return null;
  const { m } = fila;
  const seq = fila.m.receiptSeq;

  const cuenta = await cuentaEvento(quoteId, await hoy());
  if (!cuenta) return null;
  // Solo la cuenta de la pareja, con el número de cada recibo para ordenar los del mismo día.
  const pareja = await db
    .select({ kind: paymentMovements.kind, monto: paymentMovements.amountCents, fecha: paymentMovements.date, seq: paymentMovements.receiptSeq, voidedAt: paymentMovements.voidedAt })
    .from(paymentMovements)
    .where(and(eq(paymentMovements.quoteId, quoteId), isNull(paymentMovements.itemId)))
    .orderBy(asc(paymentMovements.date));
  const movimientos = pareja.flatMap((x) =>
    x.kind === "cobro" || x.kind === "devolucion" ? [{ kind: x.kind, monto: x.monto, fecha: x.fecha, seq: x.seq, anulado: x.voidedAt !== null }] : [],
  );
  const { pagado, saldo } = saldoAlRecibo(cuenta.total, movimientos, { fecha: m.date, seq });
  const c = cuenta.cotizacion;

  return {
    kind: m.kind,
    codigo,
    fecha: fechaLarga(m.date),
    cliente: c.clientName,
    monto: m.amountCents,
    codigoCotizacion: c.code,
    fechaEvento: fechaLarga(c.eventDate),
    forma: ETIQUETA_FORMA[m.method],
    referencia: m.reference,
    total: cuenta.total,
    pagado,
    saldo,
    recibidoPor: fila.recibidoPor,
    anulado: m.voidedAt !== null,
    empresa: contactoEmpresa(await datosEmpresa(), `Hola, les escribo por el recibo ${codigo}`),
  };
}
