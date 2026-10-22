import { clases } from "@/components/ui";
import { formatoBs } from "@/lib/cotizacion/dinero";
import type { OpcionProveedor } from "../datos";
import { ElegirProveedor } from "./elegir-proveedor";
import { Linea, type LineaVista } from "./linea";
import { LineaLibre } from "./linea-libre";

/**
 * Una categoría del armado con sus líneas. Sin categoría (null) es la sección final "Líneas libres"
 * (no "Otros": ya hay una categoría con ese nombre). "Omitir" una categoría es simplemente no elegir nada.
 */
export function Categoria({
  versionId,
  categoria,
  lineas,
  opciones,
  invitados,
  editable,
}: {
  versionId: string;
  categoria: { id: string; name: string } | null;
  lineas: LineaVista[];
  opciones: OpcionProveedor[];
  invitados: number;
  editable: boolean;
}) {
  const subtotal = lineas.reduce((s, l) => s + l.totalCents, 0);
  return (
    <section className={`${clases.tarjeta} p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate font-semibold text-texto">{categoria?.name ?? "Líneas libres"}</h3>
        {lineas.length > 1 && <span className="shrink-0 text-sm text-texto-suave tabular-nums">{formatoBs(subtotal)}</span>}
        {editable && lineas.length === 0 && categoria && (
          <ElegirProveedor versionId={versionId} categoria={categoria} opciones={opciones} invitados={invitados} hayLineas={false} />
        )}
      </div>
      {lineas.length > 0 ? (
        <ul className="mt-3 divide-y divide-borde border-t border-borde pt-3">
          {lineas.map((l) => (
            <Linea key={l.id} l={l} invitados={invitados} editable={editable} />
          ))}
        </ul>
      ) : (
        !categoria && <p className="mt-1 text-sm text-texto-suave">Montos sin proveedor, como recuerdos para invitados o imprevistos.</p>
      )}
      {editable && (lineas.length > 0 || !categoria) && (
        <div className="mt-3 border-t border-borde pt-3">
          {categoria ? <ElegirProveedor versionId={versionId} categoria={categoria} opciones={opciones} invitados={invitados} hayLineas /> : <LineaLibre versionId={versionId} />}
        </div>
      )}
    </section>
  );
}
