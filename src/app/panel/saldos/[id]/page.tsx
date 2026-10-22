import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { MAX_COMPROBANTE } from "@/lib/archivos";
import { requireEquipo } from "@/lib/auth";
import { formatoBs } from "@/lib/cotizacion/dinero";
import { datosEmpresa } from "@/lib/empresa";
import { fechaCorta, fechaLarga, horario, hoy as hoyFn, sumarDias } from "@/lib/fechas";
import { hasPermission } from "@/lib/permissions";
import { permitidoEnCancelada } from "@/lib/saldos/movimiento";
import { ETIQUETA_FORMA } from "@/lib/saldos/recibo";
import { IconoAccion } from "@/components/iconos";
import { Encabezado, Insignia, clases, formatoFecha } from "@/components/ui";
import { cuentaEvento, type CuentaEvento, type MovimientoCuenta, type ProveedorCuenta } from "../datos";
import { InsigniaCuota } from "../insignia-cuota";
import { AgregarAjuste } from "./_componentes/ajuste";
import { Anular } from "./_componentes/anular";
import { CambiarFecha } from "./_componentes/cambiar-fecha";
import { Cancelar } from "./_componentes/cancelar";
import { EditarPlan } from "./_componentes/editor-plan";
import { MostrarPagos } from "./_componentes/mostrar-pagos";
import { MontoProveedor, QuienPaga } from "./_componentes/proveedor";
import { Registrar } from "./_componentes/registrar";

export const metadata: Metadata = { title: "Saldos del evento" };
export const instant = false;

type Permisos = { crear: boolean; editar: boolean; eliminar: boolean };

export default async function SaldoEventoPage({ params }: PageProps<"/panel/saldos/[id]">) {
  const yo = await requireEquipo("saldos.ver");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const hoy = await hoyFn();
  const cuenta = await cuentaEvento(id, hoy);
  if (!cuenta) notFound();
  const { cotizacion: c } = cuenta;
  const cancelada = c.status === "cancelled";
  const p: Permisos = { crear: hasPermission(yo, "saldos.crear"), editar: hasPermission(yo, "saldos.editar"), eliminar: hasPermission(yo, "saldos.eliminar") };
  // Cambiar fecha y cancelar tocan también la cotización: piden además «Cotizaciones: editar».
  const delEvento = p.editar && hasPermission(yo, "cotizaciones.editar") && c.status === "accepted";
  const politica = delEvento ? (await datosEmpresa()).politica : null;

  return (
    <div className="w-full space-y-5">
      <Encabezado
        seccion="Finanzas"
        titulo={c.clientName}
        descripcion={`${c.code} · ${fechaLarga(c.eventDate)}`}
        volver={{ href: "/panel/saldos", texto: "Saldos pendientes" }}
      >
        {hasPermission(yo, "cotizaciones.ver") && (
          <Link href={`/panel/cotizaciones/${c.id}`} className={clases.botonSecundario}>
            Ver cotización <IconoAccion accion="siguiente" className="size-3.5" />
          </Link>
        )}
        {p.editar && !cancelada && (
          <EditarPlan
            tipo="pareja"
            refId={c.id}
            titulo="Editar plan de cobros"
            cuotas={cuenta.cuotas.map((q) => ({ nombre: q.nombre, monto: q.monto, vence: q.vence }))}
            total={cuenta.total}
            pagado={cuenta.cobrado}
            hoy={hoy}
          />
        )}
        {delEvento && (
          <>
            <CambiarFecha
              quoteId={c.id}
              fechaActual={fechaLarga(c.eventDate)}
              horarioActual={horario(c.startTime, c.endTime)}
              manana={sumarDias(hoy, 1)}
              puedeAjustar={p.crear}
            />
            <Cancelar
              quoteId={c.id}
              codigo={c.code}
              hoy={hoy}
              maxBytes={MAX_COMPROBANTE}
              resumen={{
                cobrado: cuenta.cobrado,
                anticipo: cuenta.cuotas[0] ? { nombre: cuenta.cuotas[0].nombre, monto: cuenta.cuotas[0].monto } : null,
                pagadoProveedores: cuenta.pagadoProveedores,
                politica,
              }}
            />
          </>
        )}
      </Encabezado>

      {p.editar ? (
        <MostrarPagos quoteId={c.id} activo={c.showPayments} />
      ) : (
        <p className="text-sm text-texto-suave">Pagos en el enlace de la pareja: {c.showPayments ? "visibles" : "ocultos"}</p>
      )}

      {cancelada && (
        <div role="status" className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error ring-1 ring-error/30 ring-inset">
          <p className="font-semibold">Evento cancelado{c.cancelledAt ? ` el ${formatoFecha(c.cancelledAt, false)}` : ""}</p>
          {c.cancelReason && <p className="mt-0.5 break-words">Motivo: {c.cancelReason}</p>}
          <p className="mt-0.5">Las cuotas pendientes ya no cuentan como deuda. Solo se pueden registrar devoluciones.</p>
        </div>
      )}

      {cuenta.ponePlataNova && (
        <div role="status" className="rounded-xl bg-oro-300/25 px-4 py-3 text-sm text-oro-700 ring-1 ring-oro-300/60 ring-inset dark:bg-oro-700/25 dark:text-oro-300 dark:ring-oro-700/50">
          Estás poniendo dinero de Nova Event: pagaste a proveedores más de lo cobrado.
        </div>
      )}

      <Numeros cuenta={cuenta} />
      <CobrosPareja cuenta={cuenta} p={p} hoy={hoy} />
      <PagosProveedores cuenta={cuenta} p={p} hoy={hoy} />
    </div>
  );
}

/* ── Tres números ───────────────────────────────────────────── */

function Numero({ titulo, valor, detalle, rojo }: { titulo: string; valor: number; detalle?: React.ReactNode; rojo?: boolean }) {
  return (
    <div className={`${clases.tarjeta} min-w-0 p-4`}>
      <p className="text-xs text-texto-suave">{titulo}</p>
      <p className={`mt-1 text-xl font-semibold break-words tabular-nums ${rojo ? "text-error" : "text-titulo"}`}>{formatoBs(valor)}</p>
      {detalle && <p className="mt-0.5 text-xs break-words text-texto-suave">{detalle}</p>}
    </div>
  );
}

function Numeros({ cuenta: k }: { cuenta: CuentaEvento }) {
  const cancelada = k.cotizacion.status === "cancelled";
  const falta = Math.max(0, k.total - k.cobrado);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Numero
        titulo="Cobrado a la pareja"
        valor={k.cobrado}
        detalle={cancelada ? (k.devuelto > 0 ? `Devuelto ${formatoBs(k.devuelto)}` : "Sin devoluciones") : `de ${formatoBs(k.total)} · falta ${formatoBs(falta)}`}
      />
      <Numero titulo="Pagado a proveedores" valor={k.pagadoProveedores} detalle={cancelada ? "Lo no devuelto es pérdida" : `falta ${formatoBs(k.faltaProveedores)}`} />
      {cancelada ? (
        <Numero titulo="Queda para Nova Event" valor={k.quedaReal} detalle="a hoy" rojo={k.quedaReal < 0} />
      ) : (
        <Numero
          titulo="Queda para Nova Event"
          valor={k.quedaPrevisto}
          rojo={k.quedaPrevisto < 0}
          detalle={
            <>
              si se cobra y paga todo · a hoy <span className={`tabular-nums ${k.quedaReal < 0 ? "text-error" : ""}`}>{formatoBs(k.quedaReal)}</span>
            </>
          }
        />
      )}
    </div>
  );
}

/* ── Cobros a la pareja ─────────────────────────────────────── */

function CobrosPareja({ cuenta: k, p, hoy }: { cuenta: CuentaEvento; p: Permisos; hoy: string }) {
  const c = k.cotizacion;
  const cancelada = c.status === "cancelled";
  const falta = Math.max(0, k.total - k.cobrado);
  const proxima = k.cuotas.find((q) => q.falta > 0);

  return (
    <section aria-labelledby="cobros-titulo" className={`${clases.tarjeta} p-4 sm:px-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="cobros-titulo" className="font-display text-lg text-titulo">
            Cobros a la pareja
          </h2>
          <p className="text-sm text-texto-suave">
            Total a cobrar <span className="font-medium text-texto tabular-nums">{formatoBs(k.total)}</span>
          </p>
        </div>
        {p.crear && (
          <div className="flex flex-wrap gap-2">
            {!cancelada && falta > 0 && (
              <Registrar
                tipo="cobro"
                refId={c.id}
                hoy={hoy}
                limite={falta}
                sugerido={proxima ? Math.min(proxima.falta, falta) : undefined}
                maxBytes={MAX_COMPROBANTE}
                boton={
                  <>
                    <IconoAccion accion="mas" /> Registrar cobro
                  </>
                }
                claseBoton={`${clases.botonPrimario} px-3 py-2`}
              />
            )}
            {!cancelada && <AgregarAjuste quoteId={c.id} />}
            {k.cobrado > 0 && (
              <Registrar
                tipo="devolucion"
                refId={c.id}
                hoy={hoy}
                limite={k.cobrado}
                maxBytes={MAX_COMPROBANTE}
                boton="Registrar devolución"
                claseBoton={`${cancelada ? clases.botonPrimario : clases.botonSecundario} px-3 py-2`}
              />
            )}
          </div>
        )}
      </div>

      <h3 className="mt-4 text-xs font-semibold tracking-wide text-texto-suave uppercase">Cuotas</h3>
      {k.cuotas.length ? (
        <ul className={`mt-1 divide-y divide-borde ${cancelada ? "opacity-60" : ""}`}>
          {k.cuotas.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
              <div className="min-w-0">
                <p className="font-medium text-texto">{q.nombre}</p>
                <p className="text-xs text-texto-suave">Vence {fechaCorta(q.vence)}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                <span className="text-right">
                  <span className="block font-medium text-texto tabular-nums">{formatoBs(q.monto)}</span>
                  {!cancelada && q.cubierto > 0 && q.falta > 0 && <span className="block text-xs text-texto-suave tabular-nums">falta {formatoBs(q.falta)}</span>}
                </span>
                {/* En una cancelada las cuotas no son deuda: sin estado. */}
                {!cancelada && <InsigniaCuota estado={q.estado} vence={q.vence} hoy={hoy} />}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-texto-suave">Sin plan de pagos.</p>
      )}

      {k.ajustes.length > 0 && (
        <>
          <h3 className="mt-5 text-xs font-semibold tracking-wide text-texto-suave uppercase">Ajustes</h3>
          <ul className="mt-1 divide-y divide-borde">
            {k.ajustes.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
                <div className={`min-w-0 ${a.anulado ? "text-texto-suave" : ""}`}>
                  <p className={`font-medium break-words ${a.anulado ? "line-through" : "text-texto"}`}>
                    {a.monto < 0 ? "Descuento" : "Cargo"}: {a.concepto}
                  </p>
                  <p className="text-xs text-texto-suave">{fechaCorta(a.fecha)}</p>
                  {a.anulado && a.motivo && <p className="text-xs break-words text-error">Anulado: {a.motivo}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-medium tabular-nums ${a.anulado ? "text-texto-suave line-through" : "text-texto"}`}>
                    {a.monto < 0 ? "−" : "+"}
                    {formatoBs(Math.abs(a.monto))}
                  </span>
                  {a.anulado ? <Insignia>Anulado</Insignia> : p.eliminar && !cancelada && <Anular id={a.id} que="ajuste" descripcion={`${a.concepto} (${a.monto < 0 ? "−" : "+"}${formatoBs(Math.abs(a.monto))})`} />}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="mt-5 text-xs font-semibold tracking-wide text-texto-suave uppercase">Movimientos</h3>
      {k.movimientos.length ? (
        <ul className="mt-1 divide-y divide-borde">
          {k.movimientos.map((m) => (
            <FilaMovimiento key={m.id} m={m} anulable={anulable(p, cancelada, m)} quoteId={k.cotizacion.id} />
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-texto-suave">Todavía no hay cobros registrados.</p>
      )}
    </section>
  );
}

/* ── Movimientos ────────────────────────────────────────────── */

const TIPO_MOVIMIENTO: Record<MovimientoCuenta["kind"], { texto: string; quien: string; sale: boolean }> = {
  cobro: { texto: "Cobro", quien: "Recibió", sale: false },
  devolucion: { texto: "Devolución a la pareja", quien: "Devolvió", sale: true },
  pago_proveedor: { texto: "Pago", quien: "Pagó", sale: false },
  devolucion_proveedor: { texto: "Devolución del proveedor", quien: "Recibió", sale: true },
};

/** Con saldos.eliminar; en una cancelada solo las devoluciones (para corregir una mal registrada). */
const anulable = (p: Permisos, cancelada: boolean, m: MovimientoCuenta) => p.eliminar && (!cancelada || permitidoEnCancelada(m.kind));

/** `quoteId` solo en los de la pareja: es donde hay recibos que abrir. */
function FilaMovimiento({ m, anulable, quoteId }: { m: MovimientoCuenta; anulable: boolean; quoteId?: string }) {
  const t = TIPO_MOVIMIENTO[m.kind];
  const detalle = [fechaCorta(m.fecha), ETIQUETA_FORMA[m.forma], m.referencia && `Ref. ${m.referencia}`, m.recibidoPor && `${t.quien}: ${m.recibidoPor}`].filter(Boolean);
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
      <div className={`min-w-0 ${m.anulado ? "text-texto-suave" : ""}`}>
        <p className={`font-medium ${m.anulado ? "line-through" : "text-texto"}`}>
          {t.texto}
          {m.recibo &&
            (m.kind === "cobro" && quoteId ? (
              <a href={`/panel/saldos/${quoteId}/recibo/${m.recibo}`} target="_blank" rel="noopener" className="ml-1.5 text-xs font-medium text-enlace hover:text-titulo">
                {m.recibo}
              </a>
            ) : (
              <span className="ml-1.5 text-xs font-normal text-texto-suave">{m.recibo}</span>
            ))}
        </p>
        <p className="text-xs break-words text-texto-suave">{detalle.join(" · ")}</p>
        {m.nota && <p className="text-xs break-words whitespace-pre-line text-texto-suave">Nota: {m.nota}</p>}
        {m.anulado && m.motivo && <p className="text-xs break-words text-error">Anulado: {m.motivo}</p>}
        {m.fileKey && (
          <a href={`/panel/saldos/comprobante/${m.fileKey}`} target="_blank" rel="noopener" className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-enlace hover:text-titulo">
            <IconoAccion accion="enlace" className="size-3.5" /> Ver comprobante
          </a>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-medium tabular-nums ${m.anulado ? "text-texto-suave line-through" : "text-texto"}`}>
          {t.sale ? "−" : ""}
          {formatoBs(m.monto)}
        </span>
        {m.anulado ? <Insignia>Anulado</Insignia> : anulable && <Anular id={m.id} que="movimiento" descripcion={`${t.texto} de ${formatoBs(m.monto)}${m.recibo ? ` (${m.recibo})` : ""}`} />}
      </div>
    </li>
  );
}

/* ── Pagos a proveedores ────────────────────────────────────── */

function PagosProveedores({ cuenta: k, p, hoy }: { cuenta: CuentaEvento; p: Permisos; hoy: string }) {
  return (
    <section aria-labelledby="proveedores-titulo" className={`${clases.tarjeta} p-4 sm:px-6`}>
      <h2 id="proveedores-titulo" className="font-display text-lg text-titulo">
        Pagos a proveedores
      </h2>
      {k.proveedores.length ? (
        <ul className="mt-2 divide-y divide-borde">
          {k.proveedores.map((l) => (
            <li key={l.itemId}>
              <FilaProveedor l={l} p={p} hoy={hoy} cancelada={k.cotizacion.status === "cancelled"} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-texto-suave">Esta cotización no tiene proveedores.</p>
      )}
    </section>
  );
}

/** Estado de la línea en una insignia (sin estados en una cancelada: sus cuotas no son deuda). */
function EstadoProveedor({ l, hoy, cancelada }: { l: ProveedorCuenta; hoy: string; cancelada: boolean }) {
  if (l.paga === "client") return <span className="text-sm text-texto-suave">Lo paga la pareja directo</span>;
  if (l.confirmacion === "unavailable") return <Insignia tono="error">No disponible</Insignia>;
  // Quedó «Por confirmar» (p. ej. al cambiar la fecha) con plan o pagos: se conservan y se muestran.
  if (l.confirmacion !== "confirmed")
    return l.cuotas.length || l.movimientos.length ? <Insignia tono="oro">Por confirmar</Insignia> : <span className="text-sm text-texto-suave">Se arma al confirmar al proveedor</span>;
  if (cancelada) return null;
  if (l.adelantoUrgente) return <Insignia tono="error">Adelanto urgente</Insignia>;
  const proxima = l.cuotas.find((q) => q.falta > 0);
  if (!proxima) return l.aPagar > 0 ? <Insignia tono="agua">Pagado</Insignia> : null;
  if (l.pagado > 0 && (proxima.estado === "pendiente" || proxima.estado === "parcial")) return <Insignia tono="agua">Al día</Insignia>;
  return <InsigniaCuota estado={proxima.estado} vence={proxima.vence} hoy={hoy} />;
}

function FilaProveedor({ l, p, hoy, cancelada }: { l: ProveedorCuenta; p: Permisos; hoy: string; cancelada: boolean }) {
  const nova = l.paga === "nova";
  const confirmado = nova && l.confirmacion === "confirmed";
  // Una línea que volvió a «Por confirmar» conserva su plan y sus pagos: se ven, pero no se editan ni se paga más.
  const conPlan = nova && (confirmado || l.cuotas.length > 0 || l.movimientos.length > 0);
  const falta = Math.max(0, l.aPagar - l.pagado);
  const proxima = l.cuotas.find((q) => q.falta > 0);
  const sinBotones = !(p.crear && ((!cancelada && confirmado && falta > 0) || l.pagado > 0)) && !(p.editar && !cancelada);

  return (
    <details className="group py-1">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg py-2.5 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-start gap-2">
          <IconoAccion accion="siguiente" className="mt-1 size-3.5 shrink-0 text-texto-suave transition group-open:rotate-90" />
          <div className="min-w-0">
            <p className="font-medium break-words text-texto">{l.proveedor}</p>
            <p className="text-xs break-words text-texto-suave">
              {l.eliminado ? "(proveedor eliminado) · " : ""}
              {l.etiqueta !== l.proveedor ? `${l.etiqueta} · ` : ""}
              {nova ? l.condicion : `Total ${formatoBs(l.totalLinea)}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 pl-5.5">
          {nova && (l.confirmacion === "confirmed" || l.pagado > 0) && (
            <span className="text-sm font-medium text-texto tabular-nums">
              {formatoBs(l.pagado)} <span className="font-normal text-texto-suave">/ {formatoBs(l.aPagar)}</span>
            </span>
          )}
          <EstadoProveedor l={l} hoy={hoy} cancelada={cancelada} />
        </div>
      </summary>

      <div className="mb-3 space-y-3 rounded-xl bg-superficie-2/50 p-3 sm:ml-5.5">
        {!nova ? (
          <p className="text-sm text-texto-suave">
            La pareja le paga {formatoBs(l.totalLinea)} directo al proveedor: no entra en el total a cobrar.
          </p>
        ) : !conPlan ? (
          <p className="text-sm text-texto-suave">
            {l.confirmacion === "unavailable" ? "El proveedor no está disponible." : "El plan de pagos se arma al confirmar al proveedor en la cotización."}
          </p>
        ) : (
          <>
            {!confirmado && (
              <p className="text-sm text-texto-suave">
                {l.confirmacion === "unavailable" ? "El proveedor no está disponible." : "El proveedor quedó por confirmar."} Su plan y sus pagos se conservan; para seguir pagándole,
                confírmalo de nuevo en la cotización.
              </p>
            )}
            {l.cuotas.length ? (
              <ul className={`divide-y divide-borde ${cancelada ? "opacity-60" : ""}`}>
                {l.cuotas.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                    <div>
                      <p className="text-sm font-medium text-texto">{q.nombre}</p>
                      <p className="text-xs text-texto-suave">Vence {fechaCorta(q.vence)}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                      <span className="text-right">
                        <span className="block text-sm font-medium text-texto tabular-nums">{formatoBs(q.monto)}</span>
                        {!cancelada && q.cubierto > 0 && q.falta > 0 && <span className="block text-xs text-texto-suave tabular-nums">falta {formatoBs(q.falta)}</span>}
                      </span>
                      {!cancelada && <InsigniaCuota estado={q.estado} vence={q.vence} hoy={hoy} />}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-texto-suave">Sin plan de pagos.</p>
            )}
            <p className="text-xs text-texto-suave">
              Monto a pagar <span className="font-medium text-texto tabular-nums">{formatoBs(l.aPagar)}</span>
              {l.aPagar !== l.totalLinea && <> (en la cotización: {formatoBs(l.totalLinea)})</>}
            </p>
            {p.editar && !cancelada && confirmado && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <EditarPlan
                  tipo="proveedor"
                  refId={l.itemId}
                  titulo={`Editar plan de pagos · ${l.proveedor}`}
                  cuotas={l.cuotas.map((q) => ({ nombre: q.nombre, monto: q.monto, vence: q.vence }))}
                  total={l.aPagar}
                  pagado={l.pagado}
                  hoy={hoy}
                />
                <MontoProveedor itemId={l.itemId} aPagar={l.aPagar} pagado={l.pagado} />
              </div>
            )}
          </>
        )}

        {l.movimientos.length > 0 && (
          <ul className="divide-y divide-borde border-t border-borde">
            {l.movimientos.map((m) => (
              <FilaMovimiento key={m.id} m={m} anulable={anulable(p, cancelada, m)} />
            ))}
          </ul>
        )}

        {!sinBotones && (
          <div className="flex flex-wrap gap-2 pt-1">
            {p.crear && !cancelada && confirmado && falta > 0 && (
              <Registrar
                tipo="pago_proveedor"
                refId={l.itemId}
                hoy={hoy}
                limite={falta}
                sugerido={proxima ? Math.min(proxima.falta, falta) : undefined}
                maxBytes={MAX_COMPROBANTE}
                quien={l.proveedor}
                boton={
                  <>
                    <IconoAccion accion="mas" /> Registrar pago
                  </>
                }
                claseBoton={`${clases.botonPrimario} px-3 py-2`}
              />
            )}
            {p.crear && l.pagado > 0 && (
              <Registrar
                tipo="devolucion_proveedor"
                refId={l.itemId}
                hoy={hoy}
                limite={l.pagado}
                maxBytes={MAX_COMPROBANTE}
                quien={l.proveedor}
                boton="Registrar devolución"
                claseBoton={`${clases.botonSecundario} px-3 py-2`}
              />
            )}
            {p.editar && !cancelada && <QuienPaga itemId={l.itemId} paga={l.paga} proveedor={l.proveedor} total={l.totalLinea} />}
          </div>
        )}
      </div>
    </details>
  );
}
