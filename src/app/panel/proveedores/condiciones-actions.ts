"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { audit, requireEquipo } from "@/lib/auth";

type Campo = "adelanto" | "dias" | "nota";

export type EstadoCondiciones =
  | { errores?: Partial<Record<Campo, string>>; error?: string; ok?: string; valores?: Partial<Record<Campo | "momento", string>> }
  | undefined;

const entero = (min: number, max: number) =>
  z.union([
    z.literal(""),
    z
      .string()
      .regex(/^\d{1,4}$/, { error: `Entre ${min} y ${max}` })
      .refine((v) => Number(v) >= min && Number(v) <= max, { error: `Entre ${min} y ${max}` }),
  ]);

const esquema = z.object({
  adelanto: entero(0, 100),
  dias: entero(0, 365),
  momento: z.enum(["antes", "mismo", "despues"], { error: "Elige cuándo se paga el resto" }),
  nota: z.string().trim().max(300, { error: "Máximo 300 caracteres" }),
});

export async function guardarCondiciones(supplierId: string, _prev: EstadoCondiciones, formData: FormData): Promise<EstadoCondiciones> {
  const yo = await requireEquipo("proveedores.editar");
  const valores = {
    adelanto: String(formData.get("adelanto") ?? "").trim(),
    dias: String(formData.get("dias") ?? "").trim(),
    momento: String(formData.get("momento") ?? "antes"),
    nota: String(formData.get("nota") ?? "").trim(),
  };
  if (!z.uuid().safeParse(supplierId).success) return { error: "Este proveedor ya no existe.", valores };
  const d = esquema.safeParse(valores);
  if (!d.success) {
    const errores: Partial<Record<Campo, string>> = {};
    for (const i of d.error.issues) {
      const k = (i.path[0] === "momento" ? "dias" : i.path[0]) as Campo;
      errores[k] ??= i.message;
    }
    return { errores, valores };
  }
  const { adelanto, dias, momento, nota } = d.data;
  // Vacío = estándar (null). «El mismo día» es 0; antes es negativo y después, positivo.
  const balanceDays = momento === "mismo" ? 0 : dias === "" ? null : momento === "antes" ? -Number(dias) : Number(dias);
  const fila = { advancePct: adelanto === "" ? null : Number(adelanto), balanceDays, paymentTerms: nota || null };
  const act = await db.update(suppliers).set(fila).where(eq(suppliers.id, supplierId)).returning({ id: suppliers.id });
  if (!act.length) return { error: "Este proveedor ya no existe.", valores };
  await audit({ action: "proveedor.condiciones_pago", userId: yo.id, entity: "proveedor", entityId: supplierId, meta: { adelanto: fila.advancePct, dias: fila.balanceDays } });
  refresh();
  return { ok: "Condiciones guardadas.", valores };
}
