import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, count, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { roles, supplierBusy, supplierCategories, supplierPackages, suppliers, users } from "@/db/schema";
import { requireEquipo } from "@/lib/auth";
import { RE_MES, esFechaValida, hoy } from "@/lib/fechas";
import { hasPermission } from "@/lib/permissions";
import { BotonConfirmar } from "@/components/boton-confirmar";
import { IconoAccion } from "@/components/iconos";
import { Aviso, Encabezado, Insignia, clases } from "@/components/ui";
import { Agenda } from "../../calendario/agenda";
import { actualizarProveedor, eliminarProveedor } from "../actions";
import { Galeria } from "../_galeria/galeria";
import { categoriasOrdenadas, galeriaDe } from "../datos";
import { FormularioProveedor } from "../formulario-proveedor";
import { CondicionesPagoVista } from "./condiciones";
import { Paquetes } from "./paquetes";

export const metadata: Metadata = { title: "Proveedor" };
export const instant = false;

const MENSAJES: Record<string, string> = {
  creado: "Proveedor creado. Ahora puedes darle acceso al sistema para que registre sus días ocupados.",
  editado: "Cambios guardados.",
  eliminado: "Listo: el día volvió a quedar libre.",
};
const MENSAJES_DIA: Record<string, string> = {
  creado: "Día marcado como ocupado.",
  creados: "Días marcados como ocupados.",
};

/** Solo enlaces web normales (evita "javascript:" y similares). */
function enlaceWeb(web: string) {
  const url = /^https?:\/\//i.test(web) ? web : `https://${web}`;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export default async function ProveedorPage({ params, searchParams }: PageProps<"/panel/proveedores/[id]">) {
  const yo = await requireEquipo("proveedores.ver");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const sp = await searchParams;

  const [p] = await db
    .select({ proveedor: suppliers, categoria: supplierCategories.name })
    .from(suppliers)
    .innerJoin(supplierCategories, eq(suppliers.categoryId, supplierCategories.id))
    .where(eq(suppliers.id, id));
  if (!p) notFound();
  const prov = p.proveedor;

  const diaHoy = await hoy();
  const diaUrl = typeof sp.dia === "string" && esFechaValida(sp.dia) ? sp.dia : null;
  const mes = typeof sp.mes === "string" && RE_MES.test(sp.mes) ? sp.mes : (diaUrl ?? diaHoy).slice(0, 7);
  const dia = diaUrl?.startsWith(mes) ? diaUrl : diaHoy.startsWith(mes) ? diaHoy : `${mes}-01`;
  // Con "dia" en la URL el mensaje viene de la agenda; sin él, de los datos del proveedor.
  const ok = typeof sp.ok === "string" ? (diaUrl ? (MENSAJES_DIA[sp.ok] ?? MENSAJES[sp.ok]) : MENSAJES[sp.ok]) : undefined;

  const puedeEditar = hasPermission(yo, "proveedores.editar");
  const puedeEliminar = hasPermission(yo, "proveedores.eliminar");
  const verUsuarios = hasPermission(yo, "usuarios.ver");
  const crearUsuarios = hasPermission(yo, "usuarios.crear");

  const [accesos, [{ proximos }], categorias, galeria, paquetes] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email, active: users.active, rol: roles.name })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.supplierId, id))
      .orderBy(asc(users.name)),
    db.select({ proximos: count() }).from(supplierBusy).where(and(eq(supplierBusy.supplierId, id), gte(supplierBusy.date, diaHoy))),
    puedeEditar ? categoriasOrdenadas() : Promise.resolve([]),
    galeriaDe(id),
    db.select().from(supplierPackages).where(eq(supplierPackages.supplierId, id)).orderBy(asc(supplierPackages.sortOrder), asc(supplierPackages.name)),
  ]);
  const web = prov.website ? enlaceWeb(prov.website) : null;

  return (
    <div className="w-full">
      <Encabezado seccion={p.categoria} titulo={prov.name} volver={{ href: "/panel/proveedores", texto: "Proveedores" }}>
        {!prov.active && <Insignia tono="error">Inactivo</Insignia>}
      </Encabezado>

      {ok && <Aviso>{ok}</Aviso>}

      {/* Resumen y contacto rápido */}
      <section className={`${clases.tarjeta} mb-5 grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]`}>
        <dl className="space-y-2.5 text-sm">
          <Dato icono="usuario" etiqueta="Contacto">
            {prov.contactName}
          </Dato>
          <Dato icono="telefono" etiqueta="Teléfono">
            {prov.phone && (
              <a href={`tel:${prov.phone.replace(/[^\d+]/g, "")}`} className="text-enlace hover:text-titulo">
                {prov.phone}
              </a>
            )}
          </Dato>
          <Dato icono="correo" etiqueta="Correo">
            {prov.email && (
              <a href={`mailto:${prov.email}`} className="break-all text-enlace hover:text-titulo">
                {prov.email}
              </a>
            )}
          </Dato>
          <Dato icono="ubicacion" etiqueta="Dirección">
            {prov.address}
          </Dato>
          <Dato icono="enlace" etiqueta="Web">
            {web ? (
              <a href={web} target="_blank" rel="noopener noreferrer" className="break-all text-enlace hover:text-titulo">
                {prov.website}
              </a>
            ) : (
              prov.website
            )}
          </Dato>
        </dl>
        <div className="space-y-4 text-sm lg:border-l lg:border-borde lg:pl-5">
          <div>
            <h2 className="font-semibold text-texto">Servicios</h2>
            <p className="mt-1 whitespace-pre-line text-texto-suave">{prov.services || "Sin descripción todavía."}</p>
          </div>
          {prov.notes && (
            <div className="rounded-xl bg-oro-300/15 px-4 py-3 dark:bg-oro-700/15">
              <h2 className="text-xs font-semibold tracking-wide text-oro-700 uppercase dark:text-oro-300">Notas del equipo</h2>
              <p className="mt-1 whitespace-pre-line text-texto">{prov.notes}</p>
            </div>
          )}
          {prov.capacity && (
            <p className="text-texto">
              <span className="font-semibold">Capacidad:</span> {prov.capacity} {prov.capacity === 1 ? "persona" : "personas"}
            </p>
          )}
          <p className="text-texto-suave">
            {proximos ? `${proximos} ${proximos === 1 ? "día ocupado próximo" : "días ocupados próximos"}.` : "No tiene días ocupados próximos."}
          </p>
        </div>
      </section>

      {/* Galería: fotos, planos, 360°, audios y videos */}
      <section className={`${clases.tarjeta} mb-5 p-5 sm:p-6`}>
        <h2 className="mb-1 text-lg font-semibold text-texto">Galería</h2>
        <p className="mb-4 text-sm text-texto-suave">Fotos de sus trabajos, planos, fotos 360°, audios y videos.</p>
        <Galeria items={galeria} editable={puedeEditar} supplierId={id} />
      </section>

      {/* Paquetes y precios */}
      <section className={`${clases.tarjeta} mb-5 p-5 sm:p-6`}>
        <h2 className="mb-1 text-lg font-semibold text-texto">Paquetes y precios</h2>
        <p className="mb-4 text-sm text-texto-suave">Lo que ofrece este proveedor y cuánto cuesta. Se usa al armar cotizaciones.</p>
        <Paquetes supplierId={id} paquetes={paquetes.map(({ id, name, description, priceCents, pricing, active }) => ({ id, name, description, priceCents, pricing, active }))} editable={puedeEditar} />
      </section>

      {/* Condiciones de pago (las usa Saldos para proponer el plan de pagos) */}
      <section className={`${clases.tarjeta} mb-5 p-5 sm:p-6`}>
        <h2 className="mb-1 text-lg font-semibold text-texto">Condiciones de pago</h2>
        <p className="mb-4 text-sm text-texto-suave">Cuánto se le adelanta y cuándo se le paga el resto. Se usa al proponer los pagos a este proveedor.</p>
        <CondicionesPagoVista supplierId={id} c={{ adelanto: prov.advancePct, dias: prov.balanceDays, nota: prov.paymentTerms }} editable={puedeEditar} />
      </section>

      {/* Disponibilidad */}
      <div className="mb-5">
        <h2 className="mb-1 text-lg font-semibold text-texto">Disponibilidad</h2>
        <p className="mb-4 text-sm text-texto-suave">
          {accesos.length
            ? "El proveedor registra sus días ocupados; aquí solo ves «Ocupado». Lo que registres tú se marca como «Registrado por Nova Event»."
            : "Este proveedor todavía no tiene acceso al sistema: puedes registrar sus días ocupados aquí cuando te los cuente."}
        </p>
        <Agenda
          supplierId={id}
          base={`/panel/proveedores/${id}`}
          mes={mes}
          dia={dia}
          hoy={diaHoy}
          editarId={typeof sp.editar === "string" ? sp.editar : null}
          esEquipo
          permisos={{ crear: puedeEditar, editar: puedeEditar, eliminar: puedeEditar }}
        />
      </div>

      <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {puedeEditar ? (
          <section className={`${clases.tarjeta} p-5 sm:p-7`}>
            <h2 className="mb-5 text-lg font-semibold text-texto">Datos del proveedor</h2>
            <FormularioProveedor
              accion={actualizarProveedor.bind(null, id)}
              categorias={categorias}
              inicial={{
                nombre: prov.name,
                categoria: prov.categoryId,
                contacto: prov.contactName ?? "",
                telefono: prov.phone ?? "",
                email: prov.email ?? "",
                direccion: prov.address ?? "",
                web: prov.website ?? "",
                servicios: prov.services ?? "",
                notas: prov.notes ?? "",
                capacidad: prov.capacity ? String(prov.capacity) : "",
                activo: prov.active,
              }}
              esNuevo={false}
            />
          </section>
        ) : (
          <div className="hidden xl:block" />
        )}

        {/* Cuentas del proveedor */}
        <section className={`${clases.tarjeta} p-5`}>
          <h2 className="font-semibold text-texto">
            Acceso al sistema <span className="font-normal text-texto-suave">({accesos.length})</span>
          </h2>
          <p className="mt-1 text-sm text-texto-suave">Con su cuenta, el proveedor entra y marca sus días ocupados. Solo ve lo suyo.</p>
          {accesos.length > 0 && (
            <ul className="mt-3 space-y-2">
              {accesos.map((u) => {
                const fila = (
                  <>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-activo text-xs font-semibold text-titulo" aria-hidden>
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-texto">{u.name}</span>
                      <span className="block truncate text-xs text-texto-suave">{u.email}</span>
                    </span>
                    {!u.active && <Insignia tono="error">Inactivo</Insignia>}
                  </>
                );
                const estilo = "flex items-center gap-3 rounded-xl border border-borde bg-superficie-2/60 px-3 py-2";
                return (
                  <li key={u.id}>
                    {verUsuarios ? (
                      <Link href={`/panel/usuarios/${u.id}`} className={`${estilo} transition hover:border-borde-campo`}>
                        {fila}
                      </Link>
                    ) : (
                      <div className={estilo}>{fila}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {crearUsuarios && (
            <Link href={`/panel/usuarios/nuevo?proveedor=${id}`} className={`${clases.botonSecundario} mt-4 w-full`}>
              <IconoAccion accion="mas" /> {accesos.length ? "Agregar otra cuenta" : "Crear su acceso"}
            </Link>
          )}
        </section>
      </div>

      {puedeEliminar && (
        <section className="flex flex-col gap-3 rounded-2xl border border-error/30 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <p className="font-semibold text-error">Eliminar proveedor</p>
            <p className="text-sm text-texto-suave">
              Se borran sus datos y su agenda.{accesos.length ? " Sus cuentas quedan sin proveedor y ya no podrán registrar días." : ""} Si solo dejó de trabajar con ustedes,
              mejor desmarca «Proveedor activo».
            </p>
          </div>
          <BotonConfirmar
            accion={eliminarProveedor.bind(null, id)}
            titulo={`¿Eliminar a ${prov.name}?`}
            mensaje="Esta acción no se puede deshacer."
            textoConfirmar="Eliminar para siempre"
            peligro
            className={`${clases.botonPeligro} shrink-0`}
          >
            <IconoAccion accion="basura" /> Eliminar
          </BotonConfirmar>
        </section>
      )}
    </div>
  );
}

function Dato({ icono, etiqueta, children }: { icono: "usuario" | "telefono" | "correo" | "ubicacion" | "enlace"; etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <IconoAccion accion={icono} className="mt-0.5 size-4 shrink-0 text-texto-suave" />
      <dt className="sr-only">{etiqueta}</dt>
      <dd className="min-w-0 text-texto">{children || <span className="text-texto-suave">Sin {etiqueta.toLowerCase()}</span>}</dd>
    </div>
  );
}
