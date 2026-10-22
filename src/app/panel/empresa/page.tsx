/* eslint-disable @next/next/no-img-element -- logos servidos desde /marca (cambian desde esta pantalla) */
import type { Metadata } from "next";
import { requireEquipo } from "@/lib/auth";
import { contactoEmpresa, datosEmpresa } from "@/lib/empresa";
import { hasPermission } from "@/lib/permissions";
import { BotonConfirmar } from "@/components/boton-confirmar";
import { Encabezado, Insignia, clases } from "@/components/ui";
import { restaurarLogo } from "./actions";
import { FormularioEmpresa, SubirLogo } from "./formularios";

export const metadata: Metadata = { title: "Empresa" };
export const instant = false;

export default async function EmpresaPage() {
  const yo = await requireEquipo("empresa.ver");
  const puedeEditar = hasPermission(yo, "empresa.editar");
  const e = await datosEmpresa();
  // La versión en la URL hace que la vista previa se actualice al cambiar el logo.
  const v = e.updatedAt?.getTime() ?? 0;

  const logos = [
    {
      tipo: "claro" as const,
      titulo: "Logo para fondo claro",
      ayuda: "Se usa en modo claro, en las propuestas, en los PDF y para los íconos de la app. Mejor PNG con fondo transparente.",
      propio: e.hasLogoLight,
      fondo: "bg-[#fbf6f3]",
    },
    {
      tipo: "oscuro" as const,
      titulo: "Logo para fondo oscuro",
      ayuda: "Se usa en modo oscuro (inicio de sesión y sistema).",
      propio: e.hasLogoDark,
      fondo: "bg-carbon",
    },
  ];

  return (
    <div className="w-full">
      <Encabezado
        seccion="Administración"
        titulo="Empresa"
        descripcion="Nombre, logos, contacto y redes de la empresa. Se muestran en el sistema, las propuestas y los PDF."
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section className={`${clases.tarjeta} p-5 sm:p-7`}>
          {puedeEditar ? (
            <FormularioEmpresa
              inicial={{
                nombre: e.name,
                lema: e.tagline ?? "",
                telefono: e.phone ?? "",
                whatsapp: e.whatsapp ?? "",
                correo: e.email ?? "",
                direccion: e.address ?? "",
                ciudad: e.city ?? "",
                web: e.website ?? "",
                instagram: e.instagram ?? "",
                facebook: e.facebook ?? "",
                tiktok: e.tiktok ?? "",
                politica: e.politica ?? "",
              }}
            />
          ) : (
            <Resumen e={e} />
          )}
        </section>

        <section className={`${clases.tarjeta} space-y-6 p-5 sm:p-6 xl:sticky xl:top-4`}>
          {logos.map((l) => (
            <div key={l.tipo}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-texto">{l.titulo}</h2>
                <Insignia tono={l.propio ? "agua" : "neutro"}>{l.propio ? "Propio" : "Original"}</Insignia>
              </div>
              <p className={`${clases.ayuda} mb-3`}>{l.ayuda}</p>
              <div className={`flex h-36 items-center justify-center rounded-xl p-4 ring-1 ring-borde ${l.fondo}`}>
                <img src={`/marca/logo-${l.tipo}.webp?v=${v}`} alt={`${l.titulo} actual`} className="max-h-full max-w-full object-contain" />
              </div>
              {puedeEditar && (
                <div className="mt-3 space-y-2">
                  <SubirLogo tipo={l.tipo} />
                  {l.propio && (
                    <BotonConfirmar
                      accion={restaurarLogo.bind(null, l.tipo)}
                      titulo="¿Volver al logo original?"
                      mensaje={l.tipo === "claro" ? "Se borra el logo subido y vuelven el logo y los íconos originales." : "Se borra el logo subido y vuelve el original."}
                      textoConfirmar="Volver al original"
                      className={`${clases.botonSecundario} w-full px-3 py-2 text-xs`}
                    >
                      Volver al logo original
                    </BotonConfirmar>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function Resumen({ e }: { e: Awaited<ReturnType<typeof datosEmpresa>> }) {
  const c = contactoEmpresa(e);
  const filas: [string, React.ReactNode][] = [
    ["Nombre", c.nombre],
    ["Lema", c.lema],
    ["WhatsApp", c.whatsapp?.texto],
    ["Teléfono", c.telefono?.texto],
    ["Correo", c.correo],
    ["Dirección", c.direccion],
    ["Sitio web", c.web?.texto],
    ["Redes", c.redes.map((r) => `${r.red} ${r.usuario}`).join(" · ") || null],
    ["Política de cambios y cancelación", e.politica && <span className="whitespace-pre-line">{e.politica}</span>],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
      {filas.map(([k, val]) => (
        <div key={k} className="contents">
          <dt className="text-texto-suave">{k}</dt>
          <dd className="break-words text-texto">{val || <span className="text-texto-suave">Sin dato</span>}</dd>
        </div>
      ))}
      <p className="mt-2 text-xs text-texto-suave sm:col-span-2">Solo puedes ver estos datos. Para cambiarlos necesitas el permiso «Empresa: editar».</p>
    </dl>
  );
}
