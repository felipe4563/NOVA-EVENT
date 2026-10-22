"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { supplierPackages, suppliers } from "@/db/schema";
import { audit, requireEquipo } from "@/lib/auth";
import { aCentavos } from "@/lib/cotizacion/dinero";

type Campo = "nombre" | "descripcion" | "precio" | "tarifa";

export type EstadoPaquete =
  | {
      errores?: Partial<Record<Campo, string>>;
      error?: string;
      ok?: string;
      valores?: Partial<Record<Campo, string>> & { activo?: boolean };
    }
  | undefined;

const esquema = z.object({
  nombre: z.string().trim().min(2, { error: "Escribe el nombre del paquete" }).max(120, { error: "Máximo 120 caracteres" }),
  descripcion: z.string().trim().max(500, { error: "Máximo 500 caracteres" }),
  precio: z.string().trim().min(1, { error: "Escribe el precio" }),
  tarifa: z.enum(["fixed", "per_person"], { error: "Elige cómo se cobra" }),
  activo: z.boolean(),
});

const esUuid = (v: string) => z.uuid().safeParse(v).success;

function leer(f: FormData) {
  return {
    nombre: String(f.get("nombre") ?? "").trim(),
    descripcion: String(f.get("descripcion") ?? "").trim(),
    precio: String(f.get("precio") ?? "").trim(),
    tarifa: String(f.get("tarifa") ?? "fixed"),
    activo: f.get("activo") === "on",
  };
}

/** Valida el formulario y convierte el precio a centavos. */
function validar(valores: ReturnType<typeof leer>) {
  const d = esquema.safeParse(valores);
  const errores: Partial<Record<Campo, string>> = {};
  if (!d.success) {
    for (const i of d.error.issues) {
      const k = String(i.path[0]) as Campo;
      if (!errores[k]) errores[k] = i.message;
    }
  }
  let centavos: number | null = null;
  if (!errores.precio) {
    centavos = aCentavos(valores.precio);
    if (centavos === null || centavos <= 0) errores.precio = "Precio no válido. Ej. 2.500 o 85,50";
  }
  if (!d.success || centavos === null || Object.keys(errores).length) return { errores } as const;
  return {
    fila: {
      name: d.data.nombre,
      description: d.data.descripcion || null,
      priceCents: centavos,
      pricing: d.data.tarifa,
      active: d.data.activo,
    },
  } as const;
}

export async function crearPaquete(supplierId: string, _prev: EstadoPaquete, formData: FormData): Promise<EstadoPaquete> {
  const yo = await requireEquipo("proveedores.editar");
  const valores = leer(formData);
  if (!esUuid(supplierId)) return { error: "Este proveedor ya no existe.", valores };
  const r = validar(valores);
  if (!r.fila) return { errores: r.errores, valores };
  const [prov] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, supplierId));
  if (!prov) return { error: "Este proveedor ya no existe.", valores };

  const existentes = await db.select({ o: supplierPackages.sortOrder }).from(supplierPackages).where(eq(supplierPackages.supplierId, supplierId));
  const sortOrder = existentes.reduce((m, e) => Math.max(m, e.o + 1), 0);
  const [nuevo] = await db.insert(supplierPackages).values({ ...r.fila, supplierId, sortOrder }).returning({ id: supplierPackages.id });
  await audit({ action: "paquete.creado", userId: yo.id, entity: "paquete", entityId: nuevo.id, meta: { proveedor: supplierId, nombre: r.fila.name } });
  refresh();
  return { ok: `Paquete «${r.fila.name}» agregado.` };
}

export async function actualizarPaquete(id: string, _prev: EstadoPaquete, formData: FormData): Promise<EstadoPaquete> {
  const yo = await requireEquipo("proveedores.editar");
  const valores = leer(formData);
  if (!esUuid(id)) return { error: "Este paquete ya no existe.", valores };
  const r = validar(valores);
  if (!r.fila) return { errores: r.errores, valores };

  const act = await db.update(supplierPackages).set(r.fila).where(eq(supplierPackages.id, id)).returning({ id: supplierPackages.id });
  if (!act.length) return { error: "Este paquete ya no existe.", valores };
  await audit({ action: "paquete.editado", userId: yo.id, entity: "paquete", entityId: id, meta: { nombre: r.fila.name } });
  refresh();
  return { ok: "Guardado.", valores };
}

export async function eliminarPaquete(id: string): Promise<string | void> {
  const yo = await requireEquipo("proveedores.editar");
  if (!esUuid(id)) return "Este paquete ya no existe.";
  const [borrado] = await db.delete(supplierPackages).where(eq(supplierPackages.id, id)).returning({ name: supplierPackages.name });
  if (!borrado) return "Este paquete ya no existe.";
  await audit({ action: "paquete.eliminado", userId: yo.id, entity: "paquete", entityId: id, meta: { nombre: borrado.name } });
  refresh();
}
