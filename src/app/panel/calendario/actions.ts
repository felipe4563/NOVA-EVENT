"use server";

import { eq } from "drizzle-orm";
import { forbidden, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { supplierBusy, suppliers } from "@/db/schema";
import { audit, requireUser, type CurrentUser } from "@/lib/auth";
import { RE_HORA, diasEntre, esFechaValida, sumarDias } from "@/lib/fechas";
import { hasPermission, type Permission } from "@/lib/permissions";
import { reservasDe } from "./reservas";

export type EstadoBloque =
  | {
      errores?: Partial<Record<"desde" | "hasta" | "inicio" | "fin" | "detalle", string>>;
      error?: string;
      valores?: { desde?: string; hasta?: string; todoElDia?: boolean; inicio?: string; fin?: string; detalle?: string };
    }
  | undefined;

/** Máximo de días que se pueden marcar de una vez. */
const MAX_DIAS = 62;

const fecha = z.string().refine(esFechaValida, { error: "Elige una fecha válida" });
const horaOpcional = z.union([z.literal(""), z.string().regex(RE_HORA, { error: "Hora no válida" })]);

const esquema = z
  .object({
    desde: fecha,
    hasta: z.union([z.literal(""), fecha]),
    todoElDia: z.boolean(),
    inicio: horaOpcional,
    fin: horaOpcional,
    detalle: z.string().trim().max(200, { error: "Máximo 200 caracteres" }),
  })
  .superRefine((d, ctx) => {
    if (d.hasta && d.hasta < d.desde) ctx.addIssue({ code: "custom", path: ["hasta"], message: "Debe ser igual o posterior a la fecha de inicio" });
    else if (d.hasta && diasEntre(d.desde, d.hasta) >= MAX_DIAS) ctx.addIssue({ code: "custom", path: ["hasta"], message: `Puedes marcar hasta ${MAX_DIAS} días de una vez` });
    if (!d.todoElDia) {
      if (!d.inicio) ctx.addIssue({ code: "custom", path: ["inicio"], message: "Indica la hora de inicio" });
      if (!d.fin) ctx.addIssue({ code: "custom", path: ["fin"], message: "Indica la hora de fin" });
      if (d.inicio && d.fin && d.fin <= d.inicio) ctx.addIssue({ code: "custom", path: ["fin"], message: "Debe ser después de la hora de inicio" });
    }
  });

function leer(f: FormData) {
  const t = (k: string) => String(f.get(k) ?? "").trim();
  return { desde: t("desde"), hasta: t("hasta"), todoElDia: f.get("todoElDia") === "on", inicio: t("inicio"), fin: t("fin"), detalle: t("detalle") };
}

function erroresDe(e: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

/**
 * Quién puede tocar la agenda de un proveedor:
 * - la cuenta del propio proveedor, con los permisos de Calendario;
 * - el equipo de Nova Event, con «Proveedores: editar» (sus bloques quedan marcados como del equipo).
 */
function acceso(yo: CurrentUser, accion: "crear" | "editar" | "eliminar") {
  if (yo.role.kind === "provider") {
    if (!yo.supplierId || !hasPermission(yo, `calendario.${accion}` as Permission)) forbidden();
    return { supplierId: yo.supplierId, esEquipo: false, volver: "/panel/calendario" };
  }
  if (yo.role.kind !== "staff" || !hasPermission(yo, "proveedores.editar")) forbidden();
  return { supplierId: null, esEquipo: true, volver: null };
}

/** Mensaje para un día que reservó la confirmación de una cotización (no se cambia desde la agenda). */
const reservado = (codigo: string) => `Este día lo reservó la cotización ${codigo}. Para liberarlo, desconfírmalo en la cotización.`;

/** Bloque que el usuario puede modificar, o null. `reserva`: código de la cotización que lo creó, si lo hay. */
async function bloquePropio(yo: CurrentUser, id: string, accion: "editar" | "eliminar") {
  const a = acceso(yo, accion);
  if (!z.uuid().safeParse(id).success) return null;
  const [b] = await db.select().from(supplierBusy).where(eq(supplierBusy.id, id));
  if (!b) return null;
  // El proveedor maneja toda su agenda; el equipo, solo lo que registró él.
  if (a.esEquipo ? !b.byStaff : b.supplierId !== a.supplierId) return null;
  const reserva = (await reservasDe([b.id])).get(b.id) ?? null;
  return { bloque: b, reserva, volver: a.volver ?? `/panel/proveedores/${b.supplierId}` };
}

/** `proveedor` solo se usa cuando lo registra el equipo; el proveedor siempre escribe en su propia agenda. */
export async function crearBloque(proveedor: string | null, _prev: EstadoBloque, formData: FormData): Promise<EstadoBloque> {
  const yo = await requireUser();
  const a = acceso(yo, "crear");
  const valores = leer(formData);

  let supplierId = a.supplierId;
  if (a.esEquipo) {
    const [p] = proveedor && z.uuid().safeParse(proveedor).success ? await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, proveedor)) : [];
    if (!p) return { error: "Este proveedor ya no existe.", valores };
    supplierId = p.id;
  }

  const datos = esquema.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };
  const d = datos.data;

  const dias = Array.from({ length: d.hasta ? diasEntre(d.desde, d.hasta) + 1 : 1 }, (_, i) => sumarDias(d.desde, i));
  await db.insert(supplierBusy).values(
    dias.map((date) => ({
      supplierId: supplierId!,
      date,
      startTime: d.todoElDia ? null : d.inicio,
      endTime: d.todoElDia ? null : d.fin,
      detail: d.detalle || null,
      byStaff: a.esEquipo,
      createdById: yo.id,
    })),
  );
  await audit({ action: "disponibilidad.creada", userId: yo.id, entity: "proveedor", entityId: supplierId!, meta: { desde: d.desde, dias: dias.length } });

  const volver = a.volver ?? `/panel/proveedores/${supplierId}`;
  redirect(`${volver}?mes=${d.desde.slice(0, 7)}&dia=${d.desde}&ok=${dias.length > 1 ? "creados" : "creado"}`);
}

export async function actualizarBloque(id: string, _prev: EstadoBloque, formData: FormData): Promise<EstadoBloque> {
  const yo = await requireUser();
  const valores = leer(formData);
  const r = await bloquePropio(yo, id, "editar");
  if (!r) return { error: "No se encontró este día ocupado o no puedes cambiarlo.", valores };
  if (r.reserva) return { error: reservado(r.reserva), valores };

  // Al editar se cambia un solo día.
  const datos = esquema.safeParse({ ...valores, hasta: "" });
  if (!datos.success) return { errores: erroresDe(datos.error), valores };
  const d = datos.data;

  await db
    .update(supplierBusy)
    .set({ date: d.desde, startTime: d.todoElDia ? null : d.inicio, endTime: d.todoElDia ? null : d.fin, detail: d.detalle || null })
    .where(eq(supplierBusy.id, id));
  await audit({ action: "disponibilidad.editada", userId: yo.id, entity: "proveedor", entityId: r.bloque.supplierId, meta: { fecha: d.desde } });
  redirect(`${r.volver}?mes=${d.desde.slice(0, 7)}&dia=${d.desde}&ok=editado`);
}

export async function eliminarBloque(id: string): Promise<string | void> {
  const yo = await requireUser();
  const r = await bloquePropio(yo, id, "eliminar");
  if (!r) return "No se encontró este día ocupado o no puedes quitarlo.";
  if (r.reserva) return reservado(r.reserva);

  await db.delete(supplierBusy).where(eq(supplierBusy.id, id));
  await audit({ action: "disponibilidad.eliminada", userId: yo.id, entity: "proveedor", entityId: r.bloque.supplierId, meta: { fecha: r.bloque.date } });
  redirect(`${r.volver}?mes=${r.bloque.date.slice(0, 7)}&dia=${r.bloque.date}&ok=eliminado`);
}
