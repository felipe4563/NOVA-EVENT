import "server-only";
import { randomUUID } from "node:crypto";
import { eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import { paymentMovements } from "@/db/schema";
import { ErrorArchivo, MAX_COMPROBANTE, borrarArchivos, guardarComprobante } from "@/lib/archivos";
import { aCentavos, formatoBs } from "@/lib/cotizacion/dinero";
import { esFechaValida } from "@/lib/fechas";
import { type TipoMovimiento, fechaMovimientoMinima, permitidoEnCancelada } from "@/lib/saldos/movimiento";
import { FORMAS_PAGO, codigoRecibo } from "@/lib/saldos/recibo";
import { unirSaltos } from "@/lib/texto";
import { type Tx, bloquear, cobradoNeto, lineaAceptada, pagadoNetoLinea, totalCotizacion } from "./planes";

/*
 * Movimientos de dinero (cobros, devoluciones y pagos a proveedores), compartidos por «Registrar…» y por
 * «Cancelar evento» (su devolución). El camino es siempre: validar → guardar el comprobante → transacción
 * (bloquear la cotización, revisar con sumas frescas, escribir); si la transacción no escribe, el comprobante se borra.
 */

export const NO_EXISTE = "Esta cotización ya no existe.";
export const LINEA_NO_EXISTE = "Esta línea ya no existe.";
export const CANCELADA = "El evento está cancelado.";
export const NO_ACEPTADA = "La cotización ya no está aceptada.";

export type { TipoMovimiento };
export type CampoMovimiento = "monto" | "fecha" | "forma" | "referencia" | "nota" | "comprobante";
export type ValoresMovimiento = Record<Exclude<CampoMovimiento, "comprobante">, string>;

const esquemaMovimiento = (hoy: string) =>
  z.object({
    monto: z
      .string()
      .trim()
      .min(1, { error: "Escribe el monto" })
      .transform((v, ctx) => {
        const c = aCentavos(v);
        if (c === null || c <= 0) {
          ctx.addIssue({ code: "custom", message: "Monto no válido (ej.: 1.500 o 1.500,50)" });
          return z.NEVER;
        }
        return c;
      }),
    fecha: z
      .string()
      .refine(esFechaValida, { error: "Elige la fecha" })
      .refine((f) => f <= hoy, { error: "La fecha no puede ser futura" })
      .refine((f) => f >= fechaMovimientoMinima(hoy), { error: "La fecha es demasiado antigua." }),
    forma: z.enum(FORMAS_PAGO, { error: "Elige la forma de pago" }),
    referencia: z.string().trim().max(80, { error: "Máximo 80 caracteres" }),
    nota: z.string().trim().max(300, { error: "Máximo 300 caracteres" }),
  });

export type DatosMovimiento = z.output<ReturnType<typeof esquemaMovimiento>>;

/** Campos del movimiento tal como llegaron, y el comprobante elegido (null si no hay). */
export function leerMovimiento(formData: FormData): { valores: ValoresMovimiento; comprobante: File | null } {
  const comprobante = formData.get("comprobante");
  return {
    valores: {
      monto: String(formData.get("monto") ?? "").trim(),
      fecha: String(formData.get("fecha") ?? ""),
      forma: String(formData.get("forma") ?? ""),
      referencia: String(formData.get("referencia") ?? "").trim(),
      nota: unirSaltos(String(formData.get("nota") ?? "")).trim(),
    },
    comprobante: comprobante instanceof File && comprobante.size > 0 ? comprobante : null,
  };
}

/** Valida los campos y el tamaño del comprobante. */
export function validarMovimiento(
  valores: ValoresMovimiento,
  comprobante: File | null,
  hoy: string,
): { datos: DatosMovimiento } | { errores: Partial<Record<CampoMovimiento, string>> } {
  const d = esquemaMovimiento(hoy).safeParse(valores);
  const errores: Partial<Record<CampoMovimiento, string>> = {};
  if (!d.success) for (const i of d.error.issues) errores[i.path[0] as CampoMovimiento] ??= i.message;
  if (comprobante && comprobante.size > MAX_COMPROBANTE) errores.comprobante = "El comprobante pesa más de 10 MB.";
  if (!d.success || errores.comprobante) return { errores };
  return { datos: d.data };
}

/**
 * Guarda el comprobante antes de la transacción (no se procesa una imagen con la cotización bloqueada),
 * corre `fn` y borra el archivo si `fn` rechaza (devuelve un texto) o falla.
 */
export async function conComprobante<T extends object>(
  quoteId: string,
  comprobante: File | null,
  fn: (archivo: { fileKey: string; mime: string } | null) => Promise<T | string>,
): Promise<{ valor: T } | { error: string } | { errorComprobante: string }> {
  let archivo: { fileKey: string; mime: string } | null = null;
  if (comprobante) {
    try {
      archivo = await guardarComprobante(quoteId, randomUUID(), Buffer.from(await comprobante.arrayBuffer()));
    } catch (e) {
      if (e instanceof ErrorArchivo) return { errorComprobante: e.message };
      console.error(e);
      return { error: "No se pudo guardar el comprobante. Intenta de nuevo." };
    }
  }
  let r: T | string;
  try {
    r = await fn(archivo);
  } catch (e) {
    await borrarArchivos(archivo?.fileKey ?? null);
    throw e;
  }
  if (typeof r === "string") {
    await borrarArchivos(archivo?.fileKey ?? null);
    return { error: r };
  }
  return { valor: r };
}

/** Reglas e inserción de cada tipo, dentro de la transacción. Devuelve un texto para rechazar. */
export async function escribirMovimiento(
  tx: Tx,
  tipo: TipoMovimiento,
  quoteId: string,
  itemId: string | null,
  d: DatosMovimiento,
  archivo: { fileKey: string; mime: string } | null,
  yoId: string,
): Promise<{ id: string; recibo: string | null; proveedor: string | null } | string> {
  const c = await bloquear(tx, quoteId);
  if (!c) return NO_EXISTE;
  if (c.status === "cancelled" && !permitidoEnCancelada(tipo)) return CANCELADA;
  if (c.status !== "accepted" && c.status !== "cancelled") return NO_ACEPTADA;

  let recibo: { receiptYear: number; receiptSeq: number; receiptCode: string } | null = null;
  let proveedor: string | null = null;

  if (tipo === "cobro") {
    const falta = (await totalCotizacion(tx, quoteId)) - (await cobradoNeto(tx, quoteId));
    if (d.monto > falta) return `Supera lo que falta cobrar (${formatoBs(Math.max(0, falta))}).`;
    // Correlativo por año de la fecha del cobro. El bloqueo de la cotización no ordena cobros de cotizaciones
    // distintas: este bloqueo por año (se suelta al terminar la transacción) sí. La restricción única es el respaldo.
    const anio = Number(d.fecha.slice(0, 4));
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`recibo-${anio}`}))`);
    const [u] = await tx.select({ n: max(paymentMovements.receiptSeq) }).from(paymentMovements).where(eq(paymentMovements.receiptYear, anio));
    const seq = (u?.n ?? 0) + 1; // los anulados también cuentan: un número nunca se reutiliza
    recibo = { receiptYear: anio, receiptSeq: seq, receiptCode: codigoRecibo(anio, seq) };
  } else if (tipo === "devolucion") {
    const cobrado = await cobradoNeto(tx, quoteId);
    if (d.monto > cobrado) return `Supera lo cobrado a la pareja (${formatoBs(Math.max(0, cobrado))}).`;
  } else {
    const l = itemId ? await lineaAceptada(tx, itemId, c) : null;
    if (!l) return LINEA_NO_EXISTE;
    proveedor = l.proveedor;
    const pagado = await pagadoNetoLinea(tx, l.id);
    if (tipo === "pago_proveedor") {
      if (l.payer !== "nova") return "Esta línea la paga la pareja directo al proveedor.";
      if (l.confirmation !== "confirmed") return "Este proveedor aún no está confirmado.";
      const falta = l.aPagar - pagado;
      if (d.monto > falta) return `Supera lo que falta pagar a este proveedor (${formatoBs(Math.max(0, falta))}).`;
    } else if (d.monto > pagado) {
      return `Supera lo pagado a este proveedor (${formatoBs(Math.max(0, pagado))}).`;
    }
  }

  const [m] = await tx
    .insert(paymentMovements)
    .values({
      quoteId,
      itemId,
      kind: tipo,
      amountCents: d.monto,
      date: d.fecha,
      method: d.forma,
      reference: d.referencia || null,
      fileKey: archivo?.fileKey ?? null,
      mime: archivo?.mime ?? null,
      ...recibo,
      handledById: yoId,
      note: d.nota || null,
      createdById: yoId,
    })
    .returning({ id: paymentMovements.id });
  return { id: m.id, recibo: recibo?.receiptCode ?? null, proveedor };
}
