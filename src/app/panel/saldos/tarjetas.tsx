import Link from "next/link";
import { formatoBs } from "@/lib/cotizacion/dinero";
import { clases } from "@/components/ui";

type Resumen = { porCobrarMes: number; vencido: number; porPagarProveedores: number; adelantosUrgentes: number };

function Tarjeta({ titulo, valor, rojo }: { titulo: string; valor: string; rojo?: boolean }) {
  return (
    <div className={`${clases.tarjeta} p-4`}>
      <p className="text-xs text-texto-suave">{titulo}</p>
      {/* En celular (2 columnas) un monto largo baja un punto de tamaño y, si igual no cabe, parte la línea sin salirse. */}
      <p className={`mt-1 text-lg font-semibold break-words tabular-nums sm:text-xl ${rojo ? "text-error" : "text-titulo"}`}>{valor}</p>
    </div>
  );
}

const urgentes = (n: number) => `${n} ${n === 1 ? "adelanto" : "adelantos"}`;

/** Tarjetas de la lista de saldos (las cuatro) y del Dashboard (tres, con enlace). */
export function TarjetasSaldos({ r, completa }: { r: Resumen; completa: boolean }) {
  const tarjetas = (
    <div className={`grid grid-cols-2 gap-3 ${completa ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
      <Tarjeta titulo="Por cobrar este mes" valor={formatoBs(r.porCobrarMes)} />
      <Tarjeta titulo="Vencido sin cobrar" valor={formatoBs(r.vencido)} rojo={r.vencido > 0} />
      {completa && <Tarjeta titulo="Por pagar a proveedores" valor={formatoBs(r.porPagarProveedores)} />}
      <Tarjeta titulo="Adelantos urgentes" valor={urgentes(r.adelantosUrgentes)} rojo={r.adelantosUrgentes > 0} />
    </div>
  );
  if (completa) return tarjetas;
  return (
    <section className="mt-8" aria-label="Saldos">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg text-titulo">Saldos</h2>
        <Link href="/panel/saldos" className="text-sm font-medium text-enlace hover:text-titulo">
          Ver saldos ›
        </Link>
      </div>
      {tarjetas}
    </section>
  );
}
