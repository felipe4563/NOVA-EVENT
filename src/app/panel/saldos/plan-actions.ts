"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { paymentInstallments, quoteItems, quoteVersions } from "@/db/schema";
import { audit, requireEquipo } from "@/lib/auth";
import { aCentavos, formatoBs } from "@/lib/cotizacion/dinero";
import { esFechaValida } from "@/lib/fechas";
import { bloquear, lineaAceptada, totalCotizacion, transaccion } from "./planes";

/*
 * Editor de planes de pago (de la pareja o de un proveedor): reemplaza todas las cuotas del plan.
 * Misma ruta que los movimientos: validar → transacción (bloquear, revisar, borrar + insertar) → auditoría → refresh().
 * La suma exacta se exige aquí, no solo en el navegador.
 */

export type EstadoPlan = { error?: string; ok?: string } | undefined;

const NO_EXISTE = "Esta cotización ya no existe.";
const LINEA_NO_EXISTE = "Esta línea ya no existe.";
const CANCELADA = "El evento está cancelado.";
const NO_ACEPTADA = "La cotización ya no está aceptada.";
const MAX_CUOTAS = 12;

const esUuid = (v: string) => z.uuid().safeParse(v).success;

type CuotaPlan = { nombre: string; monto: number; vence: string };

/** Lee y valida las filas del formulario. Devuelve las cuotas o el texto del primer problema. */
function leerCuotas(fd: FormData): CuotaPlan[] | string {
  const nombres = fd.getAll("nombre").map(String);
  const montos = fd.getAll("monto").map(String);
  const fechas = fd.getAll("vence").map(String);
  const n = nombres.length;
  if (n < 1 || n > MAX_CUOTAS) return `El plan lleva de 1 a ${MAX_CUOTAS} cuotas.`;
  if (montos.length !== n || fechas.length !== n) return "El plan no es válido. Recarga la página e inténtalo de nuevo.";
  const cuotas: CuotaPlan[] = [];
  for (let i = 0; i < n; i++) {
    const nombre = nombres[i].trim();
    if (!nombre) return `Escribe el nombre de la cuota ${i + 1}.`;
    if (nombre.length > 60) return `El nombre de la cuota ${i + 1} admite hasta 60 caracteres.`;
    const monto = aCentavos(montos[i]);
    if (monto === null || monto <= 0) return `Monto no válido en la cuota ${i + 1} (ej.: 1.500 o 1.500,50).`;
    if (!esFechaValida(fechas[i])) return `Elige la fecha de la cuota ${i + 1}.`;
    cuotas.push({ nombre, monto, vence: fechas[i] });
  }
  return cuotas;
}

const suma = (cuotas: CuotaPlan[]) => cuotas.reduce((s, c) => s + c.monto, 0);
const mensajeSuma = (cuotas: CuotaPlan[], total: number) => `El plan suma ${formatoBs(suma(cuotas))} y el total es ${formatoBs(total)}.`;

/** Edita el plan de cobros a la pareja. La suma debe ser exactamente el total a cobrar. */
export async function guardarPlanPareja(quoteId: string, _prev: EstadoPlan, fd: FormData): Promise<EstadoPlan> {
  const yo = await requireEquipo("saldos.editar");
  if (!esUuid(quoteId)) return { error: NO_EXISTE };
  const cuotas = leerCuotas(fd);
  if (typeof cuotas === "string") return { error: cuotas };

  const r = await transaccion(async (tx) => {
    const c = await bloquear(tx, quoteId);
    if (!c) return NO_EXISTE;
    if (c.status === "cancelled") return CANCELADA;
    if (c.status !== "accepted") return NO_ACEPTADA;
    const total = await totalCotizacion(tx, quoteId);
    if (suma(cuotas) !== total) return mensajeSuma(cuotas, total);
    await tx.delete(paymentInstallments).where(and(eq(paymentInstallments.quoteId, quoteId), isNull(paymentInstallments.itemId)));
    await tx.insert(paymentInstallments).values(cuotas.map((q, i) => ({ quoteId, itemId: null, name: q.nombre, amountCents: q.monto, dueDate: q.vence, sortOrder: i })));
    return { n: cuotas.length };
  });
  if (typeof r === "string") return { error: r };
  await audit({ action: "saldo.plan.editado", userId: yo.id, entity: "cotizacion", entityId: quoteId, meta: { plan: "pareja", cuotas: r.n } });
  refresh();
  return { ok: "Plan guardado." };
}

/** Edita el plan de pagos a un proveedor (línea aceptada, la paga Nova y confirmada). La suma debe ser su monto a pagar. */
export async function guardarPlanProveedor(itemId: string, _prev: EstadoPlan, fd: FormData): Promise<EstadoPlan> {
  const yo = await requireEquipo("saldos.editar");
  if (!esUuid(itemId)) return { error: LINEA_NO_EXISTE };
  const cuotas = leerCuotas(fd);
  if (typeof cuotas === "string") return { error: cuotas };
  const [ref] = await db
    .select({ quoteId: quoteVersions.quoteId })
    .from(quoteItems)
    .innerJoin(quoteVersions, eq(quoteItems.versionId, quoteVersions.id))
    .where(eq(quoteItems.id, itemId));
  if (!ref) return { error: LINEA_NO_EXISTE };
  const quoteId = ref.quoteId;

  const r = await transaccion(async (tx) => {
    const c = await bloquear(tx, quoteId);
    if (!c) return NO_EXISTE;
    if (c.status === "cancelled") return CANCELADA;
    if (c.status !== "accepted") return NO_ACEPTADA;
    const l = await lineaAceptada(tx, itemId, c);
    if (!l) return LINEA_NO_EXISTE;
    if (l.payer !== "nova") return "Esta línea la paga la pareja directo al proveedor.";
    if (l.confirmation !== "confirmed") return "Este proveedor aún no está confirmado.";
    if (suma(cuotas) !== l.aPagar) return mensajeSuma(cuotas, l.aPagar);
    await tx.delete(paymentInstallments).where(eq(paymentInstallments.itemId, itemId));
    await tx.insert(paymentInstallments).values(cuotas.map((q, i) => ({ quoteId, itemId, name: q.nombre, amountCents: q.monto, dueDate: q.vence, sortOrder: i })));
    return { n: cuotas.length };
  });
  if (typeof r === "string") return { error: r };
  await audit({ action: "saldo.plan.editado", userId: yo.id, entity: "cotizacion", entityId: quoteId, meta: { plan: itemId, cuotas: r.n } });
  refresh();
  return { ok: "Plan guardado." };
}
