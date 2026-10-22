import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, supplierCategories, suppliers } from "@/db/schema";
import { TIPOS_CUENTA } from "@/lib/permissions";

/** Roles para el desplegable del formulario, con el nombre de su tipo de cuenta. */
export async function rolesParaFormulario() {
  const lista = await db.select({ id: roles.id, name: roles.name, kind: roles.kind }).from(roles).orderBy(asc(roles.name));
  const orden = Object.keys(TIPOS_CUENTA);
  return lista
    .sort((a, b) => orden.indexOf(a.kind) - orden.indexOf(b.kind))
    .map((r) => ({ id: r.id, name: r.name, tipo: TIPOS_CUENTA[r.kind], esProveedor: r.kind === "provider" }));
}

/** Proveedores para vincular cuentas de tipo proveedor. */
export function proveedoresParaFormulario() {
  return db
    .select({ id: suppliers.id, name: suppliers.name, categoria: supplierCategories.name })
    .from(suppliers)
    .innerJoin(supplierCategories, eq(suppliers.categoryId, supplierCategories.id))
    .orderBy(asc(suppliers.name));
}
