import type { Metadata } from "next";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { requireEquipo } from "@/lib/auth";
import { BotonConfirmar } from "@/components/boton-confirmar";
import { IconoAccion } from "@/components/iconos";
import { Encabezado, Insignia, clases } from "@/components/ui";
import { crearCategoria, eliminarCategoria, moverCategoria, renombrarCategoria } from "../actions";
import { categoriasOrdenadas } from "../datos";
import { MoverCategoria, NuevaCategoria, RenombrarCategoria } from "./formularios";

export const metadata: Metadata = { title: "Categorías de proveedores" };
export const instant = false;

export default async function CategoriasPage() {
  await requireEquipo("proveedores.editar");
  const [categorias, uso] = await Promise.all([
    categoriasOrdenadas(),
    db.select({ categoryId: suppliers.categoryId, total: count() }).from(suppliers).groupBy(suppliers.categoryId),
  ]);
  const usos = new Map(uso.map((u) => [u.categoryId, u.total]));

  return (
    <div className="w-full">
      <Encabezado
        seccion="Proveedores"
        titulo="Categorías"
        descripcion="Los rubros con los que se agrupan los proveedores."
        volver={{ href: "/panel/proveedores", texto: "Proveedores" }}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className={`${clases.tarjeta} overflow-hidden`}>
          <ul className="divide-y divide-borde">
            {categorias.map((c, i) => {
              const n = usos.get(c.id) ?? 0;
              return (
                <li key={c.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-3">
                  <RenombrarCategoria accion={renombrarCategoria.bind(null, c.id)} nombre={c.name} id={c.id} />
                  <div className="flex items-center justify-between gap-2 sm:h-[38px] sm:justify-end">
                    <MoverCategoria
                      nombre={c.name}
                      alSubir={i > 0 ? moverCategoria.bind(null, c.id, "arriba") : undefined}
                      alBajar={i < categorias.length - 1 ? moverCategoria.bind(null, c.id, "abajo") : undefined}
                    />
                    <Insignia>{n ? `${n} ${n === 1 ? "proveedor" : "proveedores"}` : "Sin proveedores"}</Insignia>
                    <BotonConfirmar
                      accion={eliminarCategoria.bind(null, c.id)}
                      titulo={`¿Eliminar «${c.name}»?`}
                      mensaje={n ? "Primero cambia de categoría a sus proveedores." : "La categoría se borra para siempre."}
                      textoConfirmar="Eliminar"
                      peligro
                      className="rounded-lg p-2 text-error hover:bg-error/10"
                    >
                      <IconoAccion accion="basura" />
                      <span className="sr-only">Eliminar {c.name}</span>
                    </BotonConfirmar>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={`${clases.tarjeta} p-5 lg:sticky lg:top-4`}>
          <h2 className="font-semibold text-texto">Nueva categoría</h2>
          <p className="mt-1 mb-4 text-sm text-texto-suave">Agrégala si falta algún rubro.</p>
          <NuevaCategoria accion={crearCategoria} />
        </section>
      </div>
    </div>
  );
}
