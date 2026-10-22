import type { Metadata } from "next";
import { asc, count } from "drizzle-orm";
import { db } from "@/db";
import { eventTypes, novaPackages, quoteVersions, quotes } from "@/db/schema";
import { requireEquipo } from "@/lib/auth";
import { BotonConfirmar } from "@/components/boton-confirmar";
import { IconoAccion } from "@/components/iconos";
import { Encabezado, Insignia, clases } from "@/components/ui";
import { deCentavos } from "@/lib/cotizacion/dinero";
import {
  crearTipoEvento,
  eliminarPaqueteNova,
  eliminarTipoEvento,
  guardarPaqueteNova,
  moverPaqueteNova,
  renombrarTipoEvento,
} from "../ajustes-actions";
import { FormularioPaquete, MoverPaquete, NuevoTipo, RenombrarTipo, type DatosPaquete } from "./formularios";

export const metadata: Metadata = { title: "Ajustes de cotizaciones" };
export const instant = false;

export default async function AjustesCotizacionesPage() {
  await requireEquipo("cotizaciones.editar");
  const [paquetes, tipos, usoPaquete, usoTipo] = await Promise.all([
    db.select().from(novaPackages).orderBy(asc(novaPackages.sortOrder), asc(novaPackages.name)),
    db.select().from(eventTypes).orderBy(asc(eventTypes.sortOrder), asc(eventTypes.name)),
    db.select({ id: quoteVersions.novaPackageId, total: count() }).from(quoteVersions).groupBy(quoteVersions.novaPackageId),
    db.select({ id: quotes.eventTypeId, total: count() }).from(quotes).groupBy(quotes.eventTypeId),
  ]);
  const usosPaquete = new Map(usoPaquete.map((u) => [u.id, u.total]));
  const usosTipo = new Map(usoTipo.map((u) => [u.id, u.total]));

  const datos = (p: (typeof paquetes)[number]): DatosPaquete => ({
    id: p.id,
    nombre: p.name,
    precio: deCentavos(p.priceCents),
    frase: p.tagline ?? "",
    descripcion: p.description ?? "",
    incluye: p.includes.join("\n"),
    base: p.basePackageId ?? "",
    tema: p.theme,
    activo: p.active,
  });
  const nuevo: DatosPaquete = { id: null, nombre: "", precio: "", frase: "", descripcion: "", incluye: "", base: "", tema: "vino", activo: true };

  return (
    <div className="w-full">
      <Encabezado
        seccion="Cotizaciones"
        titulo="Ajustes"
        descripcion="Los paquetes de Nova Event y los tipos de evento que se eligen al cotizar."
        volver={{ href: "/panel/cotizaciones", texto: "Cotizaciones" }}
      />

      <h2 className="font-display mb-3 text-xl text-titulo">Paquetes de Nova Event</h2>
      <div className="space-y-5">
        {paquetes.map((p, i) => {
          const n = usosPaquete.get(p.id) ?? 0;
          const otros = paquetes.filter((o) => o.id !== p.id).map((o) => ({ id: o.id, nombre: o.name }));
          return (
            <section key={p.id} className={clases.tarjeta}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-5 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate font-semibold text-texto">{p.name}</h3>
                  {!p.active && <Insignia>Inactivo</Insignia>}
                </div>
                <div className="flex items-center gap-2">
                  <MoverPaquete
                    nombre={p.name}
                    alSubir={i > 0 ? moverPaqueteNova.bind(null, p.id, "arriba") : undefined}
                    alBajar={i < paquetes.length - 1 ? moverPaqueteNova.bind(null, p.id, "abajo") : undefined}
                  />
                  <BotonConfirmar
                    accion={eliminarPaqueteNova.bind(null, p.id)}
                    titulo={`¿Eliminar «${p.name}»?`}
                    mensaje={`Las cotizaciones que lo usan quedarán sin paquete${n ? ` (${n} ${n === 1 ? "versión" : "versiones"})` : ""}. Las aceptadas conservan su copia. No se puede deshacer.`}
                    textoConfirmar="Eliminar"
                    peligro
                    className="rounded-lg p-2 text-error hover:bg-error/10"
                  >
                    <IconoAccion accion="basura" />
                    <span className="sr-only">Eliminar {p.name}</span>
                  </BotonConfirmar>
                </div>
              </div>
              <FormularioPaquete accion={guardarPaqueteNova.bind(null, p.id)} inicial={datos(p)} otros={otros} />
            </section>
          );
        })}

        <section className={clases.tarjeta}>
          <div className="border-b border-borde px-5 py-3">
            <h3 className="font-semibold text-texto">Nuevo paquete</h3>
          </div>
          <FormularioPaquete accion={guardarPaqueteNova.bind(null, null)} inicial={nuevo} otros={paquetes.map((o) => ({ id: o.id, nombre: o.name }))} />
        </section>
      </div>

      <h2 className="font-display mt-10 mb-3 text-xl text-titulo">Tipos de evento</h2>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className={`${clases.tarjeta} overflow-hidden`}>
          <ul className="divide-y divide-borde">
            {tipos.map((t) => {
              const n = usosTipo.get(t.id) ?? 0;
              return (
                <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-3">
                  <RenombrarTipo accion={renombrarTipoEvento.bind(null, t.id)} nombre={t.name} id={t.id} />
                  <div className="flex items-center justify-between gap-2 sm:h-[38px] sm:justify-end">
                    <Insignia>{n ? `${n} ${n === 1 ? "cotización" : "cotizaciones"}` : "Sin cotizaciones"}</Insignia>
                    <BotonConfirmar
                      accion={eliminarTipoEvento.bind(null, t.id)}
                      titulo={`¿Eliminar «${t.name}»?`}
                      mensaje={n ? "Primero cambia de tipo a sus cotizaciones." : "El tipo de evento se borra para siempre."}
                      textoConfirmar="Eliminar"
                      peligro
                      className="rounded-lg p-2 text-error hover:bg-error/10"
                    >
                      <IconoAccion accion="basura" />
                      <span className="sr-only">Eliminar {t.name}</span>
                    </BotonConfirmar>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={`${clases.tarjeta} p-5 lg:sticky lg:top-4`}>
          <h3 className="font-semibold text-texto">Nuevo tipo de evento</h3>
          <p className="mt-1 mb-4 text-sm text-texto-suave">Agrégalo si falta alguno.</p>
          <NuevoTipo accion={crearTipoEvento} />
        </section>
      </div>
    </div>
  );
}
