import Link from "next/link";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { supplierBusy } from "@/db/schema";
import { BotonConfirmar } from "@/components/boton-confirmar";
import { IconoAccion } from "@/components/iconos";
import { Insignia, clases } from "@/components/ui";
import { agruparPorDia, fechaLarga, hora, horario, semanasDelMes } from "@/lib/fechas";
import { actualizarBloque, crearBloque, eliminarBloque } from "./actions";
import { FormularioBloque } from "./formulario-bloque";
import { Mes, type MarcaDia } from "./mes";
import { reservasDe } from "./reservas";

type Bloque = typeof supplierBusy.$inferSelect;

/** Resume los bloques de un día para pintarlo en el calendario. */
export function marcaDe(bloques: { startTime: string | null; endTime: string | null }[]): MarcaDia | undefined {
  if (!bloques.length) return undefined;
  if (bloques.some((b) => !b.startTime)) return { tono: "ocupado", texto: "Todo el día" };
  return { tono: "parcial", texto: bloques.length === 1 ? horario(bloques[0].startTime, bloques[0].endTime) : `${bloques.length} horarios` };
}

export function rangoDelMes(mes: string) {
  const semanas = semanasDelMes(mes);
  return { desde: semanas[0][0].fecha, hasta: semanas.at(-1)!.at(-1)!.fecha };
}

/**
 * Agenda de un proveedor: calendario del mes y, al lado, el día elegido con sus horarios.
 * - Vista del proveedor: ve el detalle de todo y maneja toda su agenda.
 * - Vista del equipo: ve "Ocupado" sin detalle, salvo lo que registró el propio equipo,
 *   que es lo único que puede cambiar.
 * Los días que reservó una cotización al confirmar al proveedor no se cambian desde aquí (se liberan en la cotización).
 */
export async function Agenda({
  supplierId,
  base,
  mes,
  dia,
  hoy,
  editarId,
  esEquipo,
  permisos,
}: {
  supplierId: string;
  /** Ruta de la página, para armar los enlaces del calendario. */
  base: string;
  mes: string;
  dia: string;
  hoy: string;
  editarId: string | null;
  esEquipo: boolean;
  permisos: { crear: boolean; editar: boolean; eliminar: boolean };
}) {
  const { desde, hasta } = rangoDelMes(mes);
  const bloques = await db
    .select()
    .from(supplierBusy)
    .where(and(eq(supplierBusy.supplierId, supplierId), gte(supplierBusy.date, desde), lte(supplierBusy.date, hasta)))
    .orderBy(asc(supplierBusy.date), asc(supplierBusy.startTime))
    // El equipo nunca recibe el detalle privado del proveedor.
    .then((lista) => (esEquipo ? lista.map((b) => (b.byStaff ? b : { ...b, detail: null })) : lista));

  const porDia = agruparPorDia(bloques);
  const marcas = Object.fromEntries([...porDia].map(([f, bs]) => [f, marcaDe(bs)!]));
  const delDia = porDia.get(dia) ?? [];
  const reservas = await reservasDe(delDia.filter((b) => b.byStaff).map((b) => b.id));
  const editable = (b: Bloque) => (!esEquipo || b.byStaff) && !reservas.has(b.id);
  const enEdicion = delDia.find((b) => b.id === editarId && editable(b) && permisos.editar);

  const href = (q: { mes: string; dia?: string }) => `${base}?mes=${q.mes}${q.dia ? `&dia=${q.dia}` : ""}`;
  const hrefDia = href({ mes, dia });

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Mes mes={mes} hoy={hoy} seleccionado={dia} marcas={marcas} href={href} />

      <section className={`${clases.tarjeta} p-5 xl:sticky xl:top-4`} aria-live="polite">
        <p className="text-xs font-medium tracking-[0.2em] text-acento uppercase">{dia === hoy ? "Hoy" : "Día elegido"}</p>
        <h2 className="mt-1 font-semibold text-texto first-letter:uppercase">{fechaLarga(dia)}</h2>

        {delDia.length === 0 ? (
          <p className="mt-3 rounded-xl bg-agua-100 px-4 py-3 text-sm text-agua-700 dark:bg-agua-700/20 dark:text-agua-300">Libre: no hay nada registrado este día.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {delDia.map((b) => {
              const verDetalle = !esEquipo || b.byStaff;
              return (
                <li key={b.id} className={`rounded-xl border px-4 py-3 ${b.id === enEdicion?.id ? "border-primario" : "border-borde"} bg-superficie-2/60`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-texto">
                        <IconoAccion accion="reloj" className="size-4 shrink-0 text-acento" />
                        {b.startTime ? `${hora(b.startTime)} – ${hora(b.endTime)}` : "Todo el día"}
                      </p>
                      <p className="mt-0.5 text-sm break-words text-texto-suave">{verDetalle ? b.detail || "Ocupado" : "Ocupado"}</p>
                      {b.byStaff && (
                        <p className="mt-1.5">
                          <Insignia tono="vino">
                            {reservas.has(b.id) ? (esEquipo ? `Reservado por cotización ${reservas.get(b.id)}` : "Reservado por Nova Event") : "Registrado por Nova Event"}
                          </Insignia>
                        </p>
                      )}
                    </div>
                    {editable(b) && (permisos.editar || permisos.eliminar) && (
                      <div className="flex shrink-0 gap-1">
                        {permisos.editar && (
                          <Link
                            href={`${hrefDia}&editar=${b.id}`}
                            scroll={false}
                            className="rounded-lg p-2 text-enlace hover:bg-activo hover:text-titulo"
                            aria-label="Editar"
                            title="Editar"
                          >
                            <IconoAccion accion="editar" />
                          </Link>
                        )}
                        {permisos.eliminar && (
                          <BotonConfirmar
                            accion={eliminarBloque.bind(null, b.id)}
                            titulo="¿Quitar este día ocupado?"
                            mensaje={`${fechaLarga(b.date)} · ${horario(b.startTime, b.endTime)}. El día volverá a verse libre.`}
                            textoConfirmar="Quitar"
                            peligro
                            className="rounded-lg p-2 text-error hover:bg-error/10"
                          >
                            <IconoAccion accion="basura" />
                            <span className="sr-only">Quitar</span>
                          </BotonConfirmar>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {enEdicion ? (
          <div className="mt-5 border-t border-borde pt-5">
            <h3 className="mb-3 text-sm font-semibold text-texto">Editar horario</h3>
            <FormularioBloque
              key={enEdicion.id}
              accion={actualizarBloque.bind(null, enEdicion.id)}
              inicial={{
                desde: enEdicion.date,
                todoElDia: !enEdicion.startTime,
                inicio: hora(enEdicion.startTime),
                fin: hora(enEdicion.endTime),
                detalle: enEdicion.detail ?? "",
              }}
              esNuevo={false}
              cancelarHref={hrefDia}
              ayudaDetalle={esEquipo ? "Lo ven el equipo y el proveedor." : "Solo lo ves tú. Nova Event solo ve «Ocupado»."}
            />
          </div>
        ) : (
          permisos.crear && (
            <div className="mt-5 border-t border-borde pt-5">
              <h3 className="mb-3 text-sm font-semibold text-texto">Marcar como ocupado</h3>
              <FormularioBloque
                key={dia}
                accion={crearBloque.bind(null, esEquipo ? supplierId : null)}
                inicial={{ desde: dia, todoElDia: true }}
                esNuevo
                ayudaDetalle={esEquipo ? "Lo ven el equipo y el proveedor." : "Solo lo ves tú. Nova Event solo ve «Ocupado»."}
              />
            </div>
          )
        )}
      </section>
    </div>
  );
}
