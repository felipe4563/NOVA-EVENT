import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { and, asc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { supplierBusy, supplierCategories, suppliers } from "@/db/schema";
import { requirePermission, type CurrentUser } from "@/lib/auth";
import { RE_MES, agruparPorDia, esFechaValida, fechaLarga, hora, hoy } from "@/lib/fechas";
import { hasPermission } from "@/lib/permissions";
import { IconoModulo } from "@/components/iconos";
import { Aviso, Encabezado, Insignia, clases } from "@/components/ui";
import { Agenda, rangoDelMes } from "./agenda";
import { Mes, type MarcaDia } from "./mes";
import { categoriasOrdenadas } from "../proveedores/datos";

export const metadata: Metadata = { title: "Calendario" };
export const instant = false;

const MENSAJES: Record<string, string> = {
  creado: "Listo: el día quedó marcado como ocupado.",
  creados: "Listo: los días quedaron marcados como ocupados.",
  editado: "Cambios guardados.",
  eliminado: "Listo: el día volvió a quedar libre.",
};

/** Mes y día a mostrar según la URL (por defecto, hoy). */
function elegirFecha(sp: Record<string, string | string[] | undefined>, diaHoy: string) {
  const diaUrl = typeof sp.dia === "string" && esFechaValida(sp.dia) ? sp.dia : null;
  const mes = typeof sp.mes === "string" && RE_MES.test(sp.mes) ? sp.mes : (diaUrl ?? diaHoy).slice(0, 7);
  const dia = diaUrl?.startsWith(mes) ? diaUrl : diaHoy.startsWith(mes) ? diaHoy : `${mes}-01`;
  return { mes, dia };
}

export default async function CalendarioPage({ searchParams }: PageProps<"/panel/calendario">) {
  const yo = await requirePermission("calendario.ver");
  const sp = await searchParams;
  const diaHoy = await hoy();
  const { mes, dia } = elegirFecha(sp, diaHoy);
  const ok = typeof sp.ok === "string" ? MENSAJES[sp.ok] : undefined;

  if (yo.role.kind === "provider") return <MiAgenda yo={yo} mes={mes} dia={dia} hoy={diaHoy} ok={ok} editarId={typeof sp.editar === "string" ? sp.editar : null} />;
  if (yo.role.kind !== "staff") forbidden();
  return <Disponibilidad yo={yo} mes={mes} dia={dia} hoy={diaHoy} cat={typeof sp.cat === "string" ? sp.cat : ""} />;
}

/* ── Vista del proveedor: su propia agenda ─────────────────────── */

async function MiAgenda({ yo, mes, dia, hoy, ok, editarId }: { yo: CurrentUser; mes: string; dia: string; hoy: string; ok?: string; editarId: string | null }) {
  const [proveedor] = yo.supplierId ? await db.select({ name: suppliers.name }).from(suppliers).where(eq(suppliers.id, yo.supplierId)) : [];

  if (!proveedor) {
    return (
      <div className="w-full">
        <Encabezado seccion="Calendario" titulo="Mi disponibilidad" />
        <div className={`${clases.tarjeta} p-8 text-center`}>
          <p className="font-semibold text-texto">Tu cuenta todavía no está vinculada a un proveedor</p>
          <p className="mt-1 text-sm text-texto-suave">Pide a Nova Event que la vincule para poder registrar tus días ocupados.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Encabezado
        seccion={proveedor.name}
        titulo="Mi disponibilidad"
        descripcion="Marca los días u horarios en que ya tienes trabajo. Nova Event solo ve «Ocupado»; el detalle es solo tuyo."
      />
      {ok && <Aviso>{ok}</Aviso>}
      <Agenda
        supplierId={yo.supplierId!}
        base="/panel/calendario"
        mes={mes}
        dia={dia}
        hoy={hoy}
        editarId={editarId}
        esEquipo={false}
        permisos={{
          crear: hasPermission(yo, "calendario.crear"),
          editar: hasPermission(yo, "calendario.editar"),
          eliminar: hasPermission(yo, "calendario.eliminar"),
        }}
      />
    </div>
  );
}

/* ── Vista del equipo: quién está ocupado y quién libre ────────── */

async function Disponibilidad({ yo, mes, dia, hoy, cat }: { yo: CurrentUser; mes: string; dia: string; hoy: string; cat: string }) {
  const verProveedores = hasPermission(yo, "proveedores.ver");
  const categorias = await categoriasOrdenadas();
  const categoria = categorias.find((c) => c.id === cat);

  const filtro: SQL[] = [eq(suppliers.active, true)];
  if (categoria) filtro.push(eq(suppliers.categoryId, categoria.id));
  const { desde, hasta } = rangoDelMes(mes);

  const [activos, bloques] = await Promise.all([
    db
      .select({ id: suppliers.id, name: suppliers.name, categoria: supplierCategories.name })
      .from(suppliers)
      .innerJoin(supplierCategories, eq(suppliers.categoryId, supplierCategories.id))
      .where(and(...filtro))
      .orderBy(asc(supplierCategories.sortOrder), asc(suppliers.name)),
    db
      .select({
        supplierId: supplierBusy.supplierId,
        date: supplierBusy.date,
        startTime: supplierBusy.startTime,
        endTime: supplierBusy.endTime,
        // El detalle del proveedor es privado: solo se lee el que registró el equipo.
        detail: sql<string | null>`case when ${supplierBusy.byStaff} then ${supplierBusy.detail} end`,
        byStaff: supplierBusy.byStaff,
      })
      .from(supplierBusy)
      .innerJoin(suppliers, eq(supplierBusy.supplierId, suppliers.id))
      .where(and(...filtro, gte(supplierBusy.date, desde), lte(supplierBusy.date, hasta)))
      .orderBy(asc(supplierBusy.date), asc(supplierBusy.startTime)),
  ]);

  const porDia = agruparPorDia(bloques);
  const marcas: Record<string, MarcaDia> = {};
  for (const [f, bs] of porDia) {
    const n = new Set(bs.map((b) => b.supplierId)).size;
    const todoElDia = bs.some((b) => !b.startTime);
    marcas[f] = { tono: todoElDia ? "ocupado" : "parcial", texto: `${n} ${n === 1 ? "ocupado" : "ocupados"}` };
  }

  // Día elegido: ocupados (con sus horarios) y libres.
  const delDia = porDia.get(dia) ?? [];
  const nombres = new Map(activos.map((p) => [p.id, p]));
  const ocupados = [...new Set(delDia.map((b) => b.supplierId))].map((id) => ({
    ...nombres.get(id)!,
    horarios: delDia.filter((b) => b.supplierId === id),
  }));
  const libres = activos.filter((p) => !ocupados.some((o) => o.id === p.id));

  const href = (q: { mes: string; dia?: string }) => `/panel/calendario?mes=${q.mes}${q.dia ? `&dia=${q.dia}` : ""}${categoria ? `&cat=${categoria.id}` : ""}`;
  const enlaceProveedor = (id: string) => (verProveedores ? `/panel/proveedores/${id}?mes=${mes}&dia=${dia}` : null);

  return (
    <div className="w-full">
      <Encabezado seccion="Calendario" titulo="Disponibilidad de proveedores" descripcion="Elige un día para ver quién está libre y quién ocupado.">
        {verProveedores && (
          <Link href="/panel/proveedores" className={clases.botonSecundario}>
            <IconoModulo modulo="proveedores" className="size-4" /> Proveedores
          </Link>
        )}
      </Encabezado>

      <form className={`${clases.tarjeta} mb-5 flex flex-col gap-3 p-3 sm:flex-row sm:items-center`}>
        <input type="hidden" name="mes" value={mes} />
        <input type="hidden" name="dia" value={dia} />
        <label htmlFor="cat" className="shrink-0 pl-1 text-sm font-medium text-texto">
          Categoría
        </label>
        <select id="cat" name="cat" defaultValue={categoria?.id ?? ""} className={`${clases.campo} sm:max-w-xs`}>
          <option value="">Todas</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className={clases.botonSecundario}>
          Ver
        </button>
        <p className="text-sm text-texto-suave sm:ml-auto">
          {activos.length} {activos.length === 1 ? "proveedor activo" : "proveedores activos"}
          {categoria && ` en ${categoria.name}`}
        </p>
      </form>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Mes mes={mes} hoy={hoy} seleccionado={dia} marcas={marcas} href={href} />

        <section className={`${clases.tarjeta} p-5 xl:sticky xl:top-4`} aria-live="polite">
          <p className="text-xs font-medium tracking-[0.2em] text-acento uppercase">{dia === hoy ? "Hoy" : "Día elegido"}</p>
          <h2 className="mt-1 font-semibold text-texto first-letter:uppercase">{fechaLarga(dia)}</h2>

          <h3 className="mt-5 flex items-center gap-2 text-sm font-semibold text-texto">
            <span className="size-2.5 rounded-full bg-primario" aria-hidden /> Ocupados ({ocupados.length})
          </h3>
          {ocupados.length === 0 ? (
            <p className="mt-2 text-sm text-texto-suave">Nadie tiene este día ocupado.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {ocupados.map((p) => (
                <li key={p.id}>
                  <Fila nombre={p.name} categoria={p.categoria} href={enlaceProveedor(p.id)}>
                    <ul className="mt-1.5 space-y-0.5">
                      {p.horarios.map((h, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-x-2 text-xs text-texto-suave">
                          <span className="font-medium text-titulo">{h.startTime ? `${hora(h.startTime)} – ${hora(h.endTime)}` : "Todo el día"}</span>
                          {h.detail ? <span className="break-words">· {h.detail}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </Fila>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-5 flex items-center gap-2 text-sm font-semibold text-texto">
            <span className="size-2.5 rounded-full bg-agua-500" aria-hidden /> Libres todo el día ({libres.length})
          </h3>
          {libres.length === 0 ? (
            <p className="mt-2 text-sm text-texto-suave">{activos.length ? "Todos tienen algo este día." : "No hay proveedores activos en esta categoría."}</p>
          ) : (
            <ul className="mt-2 max-h-96 space-y-2 overflow-y-auto pr-1 barra-fina">
              {libres.map((p) => (
                <li key={p.id}>
                  <Fila nombre={p.name} categoria={p.categoria} href={enlaceProveedor(p.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Fila({ nombre, categoria, href, children }: { nombre: string; categoria: string; href: string | null; children?: React.ReactNode }) {
  const contenido = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-texto">{nombre}</span>
        <Insignia>{categoria}</Insignia>
      </span>
      {children}
    </>
  );
  const estilo = "block rounded-xl border border-borde bg-superficie-2/60 px-3.5 py-2.5";
  return href ? (
    <Link href={href} className={`${estilo} transition hover:border-borde-campo`}>
      {contenido}
    </Link>
  ) : (
    <div className={estilo}>{contenido}</div>
  );
}
