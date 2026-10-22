import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { Quote } from "@/db/schema";
import { requireEquipo } from "@/lib/auth";
import { deCentavos, formatoBs } from "@/lib/cotizacion/dinero";
import { fechaLarga, hoy as hoyFn, horario, hora } from "@/lib/fechas";
import { origenDe } from "@/lib/origen";
import { hasPermission } from "@/lib/permissions";
import { totalesVersion } from "@/lib/cotizacion/calculo";
import { leerLineaCongelada, leerVersionCongelada } from "@/lib/cotizacion/propuesta";
import { IconoAccion } from "@/components/iconos";
import { Encabezado, Insignia, clases } from "@/components/ui";
import Link from "next/link";
import { cuentaEvento } from "../../saldos/datos";
import { actualizarDatos } from "../actions";
import { BarraEstado } from "../_armado/barra-estado";
import { Categoria } from "../_armado/categoria";
import { Compartir } from "../_armado/compartir";
import { Confirmaciones, type LineaConfirmacion } from "../_armado/confirmaciones";
import { FormularioDatos } from "../_armado/formulario-datos";
import { InsigniaEstado } from "../_armado/estado-cotizacion";
import type { LineaVista } from "../_armado/linea";
import { PaqueteNova } from "../_armado/paquete-nova";
import { ResumenLateral, ResumenMovil } from "../_armado/resumen";
import { Versiones } from "../_armado/versiones";
import { ZonaDelicada } from "../_armado/zona-delicada";
import {
  cargarCotizacion,
  categoriasArmado,
  disponibilidadDe,
  equipoActivo,
  fechasDeOcupados,
  opcionesProveedores,
  paquetesNova,
  paquetesVigentes,
  proveedoresDeLineas,
  tiposActivos,
} from "../datos";

export const metadata: Metadata = { title: "Cotización" };
export const instant = false;

export default async function CotizacionPage({ params, searchParams }: PageProps<"/panel/cotizaciones/[id]">) {
  const yo = await requireEquipo("cotizaciones.ver");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const datos = await cargarCotizacion(id);
  if (!datos) notFound();
  const { cotizacion: c, tipo, versiones } = datos;
  const sp = await searchParams;
  const hoy = await hoyFn();
  const cuenta = c.status === "accepted" || c.status === "cancelled" ? await cuentaEvento(id, hoy) : null;
  const verSaldos = hasPermission(yo, "saldos.ver");
  const aceptada = c.status === "accepted";
  const conEditar = hasPermission(yo, "cotizaciones.editar");
  const puedeEditar = conEditar && !aceptada;
  const invitados = c.guests ?? 0;
  const horarioEvento = { inicio: c.startTime, fin: c.endTime };
  const versionAceptada = aceptada ? versiones.find((v) => v.id === c.acceptedVersionId) : undefined;
  // Días ocupados creados por las confirmaciones de esta cotización (no cuentan como conflicto).
  const propios = versionAceptada?.lineas.flatMap((l) => (l.busyId ? [l.busyId] : [])) ?? [];

  // Versión abierta: la de ?v=, si no la aceptada, o la primera por orden.
  const activa = versiones.find((v) => v.id === sp.v) ?? versionAceptada ?? versiones[0];
  const idsLineas = [...new Set(activa?.lineas.flatMap((l) => (l.supplierId ? [l.supplierId] : [])) ?? [])];
  const idsPaquetes = [...new Set(activa?.lineas.flatMap((l) => (l.supplierPackageId ? [l.supplierPackageId] : [])) ?? [])];
  const [categorias, nova, opciones, provLineas, dispLineas, fechasPropios, vigentes] = await Promise.all([
    categoriasArmado(),
    paquetesNova(),
    puedeEditar ? opcionesProveedores(null, c.eventDate, horarioEvento, invitados) : Promise.resolve([]),
    proveedoresDeLineas(idsLineas),
    // Se recalcula en cada visita: si cambia la fecha o el horario, los avisos se actualizan solos.
    disponibilidadDe(idsLineas, c.eventDate, horarioEvento, propios),
    fechasDeOcupados(propios),
    puedeEditar ? paquetesVigentes(idsPaquetes) : Promise.resolve(new Set<string>()),
  ]);
  const precioNova = new Map(nova.map((p) => [p.id, p.priceCents]));
  type Version = (typeof versiones)[number];
  // La versión aceptada usa su copia congelada (nombres y montos de cuando se aceptó).
  const esCongelada = (v: Version) => v.id === versionAceptada?.id;
  const novaCongelada = (v: Version) => (esCongelada(v) ? leerVersionCongelada(v.frozen) : null);
  const novaDe = (v: Version) => novaCongelada(v)?.precio ?? (v.novaPackageId ? (v.novaPriceCents ?? precioNova.get(v.novaPackageId) ?? 0) : 0);
  const totalLineaDe = (v: Version, l: Version["lineas"][number]) => (esCongelada(v) ? leerLineaCongelada(l.frozen)?.total : undefined) ?? l.totalCents;
  const totalesDe = (v: Version) => totalesVersion(v.lineas.map((l) => ({ total: totalLineaDe(v, l) })), novaDe(v));
  const pestanas = versiones.map((v) => ({
    id: v.id,
    name: v.name,
    visible: v.showInProposal,
    total: totalesDe(v).general,
    estado: aceptada ? (esCongelada(v) ? ("aceptada" as const) : ("archivada" as const)) : undefined,
  }));
  const fzActiva = activa ? novaCongelada(activa) : null;

  // Confirmación de proveedores (versión aceptada), en el orden de las categorías.
  const ordenCategoria = new Map(categorias.map((k, i) => [k.id, i]));
  const confirmaciones: (LineaConfirmacion & { busyId: string | null })[] = (versionAceptada?.lineas ?? [])
    .filter((l) => l.confirmation !== null)
    .sort((a, b) => (ordenCategoria.get(a.categoryId ?? "") ?? Infinity) - (ordenCategoria.get(b.categoryId ?? "") ?? Infinity))
    .map((l) => {
      const f = leerLineaCongelada(l.frozen);
      return {
        id: l.id,
        proveedor: f?.proveedor ?? null,
        etiqueta: f?.etiqueta ?? l.label,
        total: f?.total ?? l.totalCents,
        confirmation: l.confirmation!,
        proveedorBorrado: l.supplierId === null,
        // Confirmado, pero su día ocupado ya no está (o quedó en otra fecha): hay que volver a reservarlo.
        reservaQuitada: l.confirmation === "confirmed" && (!l.busyId || fechasPropios.get(l.busyId) !== c.eventDate),
        busyId: l.busyId,
      };
    });
  const liberar = confirmaciones.filter((l) => l.busyId).map((l) => l.proveedor ?? l.etiqueta);
  const diaEvento = `${fechaLarga(c.eventDate)}${c.startTime && c.endTime ? `, ${horario(c.startTime, c.endTime)}` : ", todo el día"}`;
  const zona = { puedeReabrir: conEditar, puedeEliminar: hasPermission(yo, "cotizaciones.eliminar") };
  // Enlace público completo (con el dominio por el que entró la persona) solo si está activo.
  const puedeCompartir = hasPermission(yo, "cotizaciones.editar");
  const enlace = c.shareEnabled && c.shareToken ? `${origenDe(await headers())}/p/${c.shareToken}` : null;
  const resumen = activa && { version: activa.name, ...totalesDe(activa), presupuesto: c.budgetCents, incluyeNova: c.includeNovaInBudget };

  return (
    <div className="w-full">
      <Encabezado
        seccion={c.code}
        titulo={c.clientName}
        descripcion={`${tipo} · ${fechaLarga(c.eventDate)} · ${invitados} ${invitados === 1 ? "invitado" : "invitados"}`}
        volver={{ href: "/panel/cotizaciones", texto: "Cotizaciones" }}
      >
        <span className="flex flex-wrap items-center gap-3">
          <InsigniaEstado status={c.status} validUntil={c.validUntil} hoy={hoy} />
          {/* Quien ve la cotización puede presentarla (la página ya exige «Cotizaciones: ver»).
              Navegación completa (no <Link>): así la página de armado, con sus notas, no queda oculta en el DOM al presentar. */}
          <a href={`/panel/cotizaciones/${id}/presentar`} className={clases.botonSecundario}>
            Presentar
          </a>
          {/* El PDF de la propuesta, para mandarlo por WhatsApp. */}
          <a href={`/panel/cotizaciones/${id}/pdf`} download className={clases.botonSecundario}>
            <IconoAccion accion="descargar" /> Descargar PDF
          </a>
        </span>
      </Encabezado>

      {puedeEditar && c.status !== "cancelled" && (
        <div className="mb-5">
          <BarraEstado quoteId={id} status={c.status} versiones={pestanas.map((p) => ({ id: p.id, name: p.name, total: p.total }))} activaId={activa?.id ?? null} />
        </div>
      )}

      {cuenta && (
        <p className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-borde bg-superficie px-4 py-3 text-sm text-texto">
          <span className="tabular-nums">
            Cobrado {formatoBs(cuenta.cobrado)} de {formatoBs(cuenta.total)} · falta {formatoBs(Math.max(0, cuenta.total - cuenta.cobrado))}
          </span>
          {verSaldos && (
            <Link href={`/panel/saldos/${id}`} className="font-medium text-enlace hover:text-titulo">
              Ver saldos ›
            </Link>
          )}
        </p>
      )}

      {aceptada && (
        <div className="mb-5 space-y-3">
          <p className="rounded-xl bg-superficie-2 px-4 py-3 text-sm text-texto-suave">
            Aceptada{c.acceptedAt ? ` el ${fechaLarga(diaDe(c.acceptedAt))}` : ""}
            {versionAceptada ? ` · ${versionAceptada.name}` : ""}. Ya no se modifica: los nombres y montos quedaron guardados tal como estaban.
          </p>
          <Confirmaciones lineas={confirmaciones} editable={conEditar} dia={diaEvento} />
        </div>
      )}

      {(puedeCompartir || enlace) && (
        <div className="mb-5">
          <Compartir quoteId={id} enlace={enlace} editable={puedeCompartir} borrador={c.status === "draft"} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="min-w-0 space-y-5">
          <details className={`${clases.tarjeta} group`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:px-6 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block font-display text-lg text-titulo">Datos del evento</span>
                <span className="block truncate text-sm text-texto-suave">
                  {horario(c.startTime, c.endTime)} · {c.budgetCents === null ? "Sin presupuesto" : `Presupuesto ${formatoBs(c.budgetCents)}`}
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium text-enlace">
                <span className="group-open:hidden">{puedeEditar ? "Ver y editar" : "Ver"}</span>
                <span className="hidden group-open:inline">Ocultar</span>
              </span>
            </summary>
            <div className="border-t border-borde p-5 sm:p-7">
              {puedeEditar ? <Edicion id={id} c={c} tipo={{ id: c.eventTypeId, name: tipo }} responsable={datos.responsable} /> : <Resumen c={c} tipo={tipo} responsable={datos.responsable} />}
            </div>
          </details>

          {activa ? (
            <>
              <Versiones quoteId={id} versiones={pestanas} activa={pestanas.find((p) => p.id === activa.id)!} editable={puedeEditar} />
              {fzActiva ? (
                <NovaCongelada nombre={fzActiva.nombre} precio={fzActiva.precio} />
              ) : (
                <PaqueteNova
                  key={activa.id}
                  versionId={activa.id}
                  paquetes={nova}
                  actualId={activa.novaPackageId}
                  precioAjustado={activa.novaPackageId ? activa.novaPriceCents : null}
                  editable={puedeEditar}
                />
              )}
              <Armado
                versionId={activa.id}
                lineas={activa.lineas}
                categorias={categorias}
                opciones={opciones}
                proveedores={provLineas}
                disponibilidad={dispLineas}
                vigentes={vigentes}
                invitados={invitados}
                editable={puedeEditar}
                congelada={esCongelada(activa)}
              />
            </>
          ) : (
            <p className={`${clases.tarjeta} p-6 text-sm text-texto-suave`}>Esta cotización no tiene versiones.</p>
          )}

          <ZonaDelicada quoteId={id} codigo={c.code} aceptada={aceptada} liberar={liberar} dia={diaEvento} {...zona} />
        </div>

        {resumen && (
          <aside className="hidden xl:sticky xl:top-20 xl:block">
            <ResumenLateral d={resumen} />
          </aside>
        )}
      </div>
      {resumen && <ResumenMovil d={resumen} />}
    </div>
  );
}

type LineaBD = NonNullable<Awaited<ReturnType<typeof cargarCotizacion>>>["versiones"][number]["lineas"][number];

/** Categorías en su orden con sus líneas; al final las líneas libres (sin categoría). */
function Armado({
  versionId,
  lineas,
  categorias,
  opciones,
  proveedores,
  disponibilidad,
  vigentes,
  invitados,
  editable,
  congelada,
}: {
  versionId: string;
  lineas: LineaBD[];
  categorias: { id: string; name: string }[];
  opciones: Awaited<ReturnType<typeof opcionesProveedores>>;
  proveedores: Awaited<ReturnType<typeof proveedoresDeLineas>>;
  disponibilidad: Awaited<ReturnType<typeof disponibilidadDe>>;
  /** Paquetes de proveedor que siguen existiendo y activos. */
  vigentes: Set<string>;
  invitados: number;
  editable: boolean;
  /** Versión aceptada: nombres y montos de la copia congelada. */
  congelada: boolean;
}) {
  const prov = new Map(proveedores.map((p) => [p.id, p]));
  const vista = (l: LineaBD): LineaVista => {
    const p = l.supplierId ? prov.get(l.supplierId) : undefined;
    const f = congelada ? leerLineaCongelada(l.frozen) : null;
    return {
      id: l.id,
      proveedor: f ? f.proveedor : (p?.name ?? null),
      proveedorInactivo: p ? !p.active : false,
      etiqueta: f?.etiqueta ?? l.label,
      pricing: l.pricing,
      unitCents: l.unitCents,
      totalCents: f?.total ?? l.totalCents,
      manualPrice: l.manualPrice,
      tienePaquete: l.supplierPackageId !== null,
      paqueteVigente: l.supplierPackageId !== null && vigentes.has(l.supplierPackageId),
      disponibilidad: l.supplierId ? (disponibilidad.get(l.supplierId)?.estado ?? null) : null,
      rangos: l.supplierId ? (disponibilidad.get(l.supplierId)?.rangos ?? []) : [],
      capacidad: p?.capacity ?? null,
    };
  };
  const conocidas = new Set(categorias.map((k) => k.id));
  const otras = lineas.filter((l) => !l.categoryId || !conocidas.has(l.categoryId)).map(vista);
  const secciones = categorias
    .map((k) => ({ k, lineas: lineas.filter((l) => l.categoryId === k.id).map(vista) }))
    // En solo lectura se muestran solo las categorías con algo elegido.
    .filter((s) => editable || s.lineas.length > 0);

  if (!editable && !secciones.length && !otras.length) {
    return <p className={`${clases.tarjeta} p-6 text-sm text-texto-suave`}>Esta versión todavía no tiene proveedores ni líneas.</p>;
  }
  return (
    <div className="space-y-3">
      <h2 className="sr-only">Proveedores y líneas</h2>
      {secciones.map(({ k, lineas: ls }) => (
        <Categoria
          key={k.id}
          versionId={versionId}
          categoria={k}
          lineas={ls}
          opciones={opciones.filter((o) => o.categoriaId === k.id)}
          invitados={invitados}
          editable={editable}
        />
      ))}
      {(editable || otras.length > 0) && <Categoria versionId={versionId} categoria={null} lineas={otras} opciones={[]} invitados={invitados} editable={editable} />}
    </div>
  );
}

/** Día (AAAA-MM-DD) de un instante en la zona horaria del negocio. */
function diaDe(t: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TIMEZONE || "America/La_Paz" }).format(t);
}

/** Paquete Nova de la versión aceptada, tal como quedó al aceptar. */
function NovaCongelada({ nombre, precio }: { nombre: string; precio: number }) {
  return (
    <section className={`${clases.tarjeta} p-4 sm:p-5`}>
      <h2 className="font-display text-base text-titulo">Paquete Nova Event</h2>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-sm text-texto">{nombre}</p>
        <p className="text-sm font-semibold text-texto tabular-nums">{formatoBs(precio)}</p>
      </div>
      <div className="mt-2">
        <Insignia tono="vino">Copia de la aceptación</Insignia>
      </div>
    </section>
  );
}

async function Edicion({ id, c, tipo, responsable }: { id: string; c: Quote; tipo: { id: string; name: string }; responsable: string | null }) {
  const [activos, activosEquipo] = await Promise.all([tiposActivos(), equipoActivo()]);
  // Igual con el responsable: si ya no está activo (o no hay), se conserva en la lista para no reasignarlo sin querer.
  const equipo = !c.ownerId
    ? [{ id: "", name: "Sin responsable" }, ...activosEquipo]
    : activosEquipo.some((u) => u.id === c.ownerId)
      ? activosEquipo
      : [{ id: c.ownerId, name: responsable ?? "Responsable anterior" }, ...activosEquipo];
  // Si el tipo de esta cotización se desactivó después, sigue apareciendo en su lista.
  const tipos = activos.some((t) => t.id === tipo.id) ? activos : [...activos, tipo];
  return (
    <FormularioDatos
      accion={actualizarDatos.bind(null, id)}
      tipos={tipos}
      equipo={equipo}
      inicial={{
        cliente: c.clientName,
        telefono: c.clientPhone ?? "",
        email: c.clientEmail ?? "",
        tipo: c.eventTypeId,
        fecha: c.eventDate,
        inicio: hora(c.startTime),
        fin: hora(c.endTime),
        invitados: c.guests ? String(c.guests) : "",
        presupuesto: c.budgetCents === null ? "" : deCentavos(c.budgetCents),
        validez: c.validUntil ?? "",
        notas: c.notes ?? "",
        responsable: c.ownerId ?? "",
        incluirNova: c.includeNovaInBudget,
        mostrarPresupuesto: c.showBudgetToClient,
      }}
      esNueva={false}
    />
  );
}

function Resumen({ c, tipo, responsable }: { c: Quote; tipo: string; responsable: string | null }) {
  const filas: [string, string][] = [
    ["Cliente", c.clientName],
    ["Teléfono", c.clientPhone ?? "—"],
    ["Correo", c.clientEmail ?? "—"],
    ["Tipo de evento", tipo],
    ["Fecha", fechaLarga(c.eventDate)],
    ["Horario", horario(c.startTime, c.endTime)],
    ["Invitados", c.guests ? String(c.guests) : "—"],
    ["Presupuesto", c.budgetCents === null ? "—" : formatoBs(c.budgetCents)],
    ["Nova Event en el presupuesto", c.includeNovaInBudget ? "Sí" : "No"],
    ["Presupuesto visible al cliente", c.showBudgetToClient ? "Sí" : "No"],
    ["Válida hasta", c.validUntil ? fechaLarga(c.validUntil) : "—"],
    ["Responsable", responsable ?? "—"],
    ["Notas internas", c.notes ?? "—"],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
      {filas.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-medium tracking-wide text-texto-suave uppercase">{k}</dt>
          <dd className="mt-1 text-sm break-words whitespace-pre-line text-texto">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
