import Link from "next/link";
import { IconoAccion } from "@/components/iconos";
import { clases } from "@/components/ui";
import { DIAS_CORTOS, nombreMes, semanasDelMes, sumarMeses } from "@/lib/fechas";

const flecha =
  "inline-flex size-9 items-center justify-center rounded-lg border border-borde-campo bg-superficie text-texto transition hover:bg-superficie-2 focus-visible:ring-3 focus-visible:ring-anillo focus-visible:outline-none";

export type MarcaDia = { tono: "ocupado" | "parcial"; texto: string };

/**
 * Calendario de un mes (lunes a domingo). Cada día es un enlace que lo selecciona.
 * En celular solo se ve un punto de color; en pantallas grandes, también el texto.
 */
export function Mes({
  mes,
  hoy,
  seleccionado,
  marcas,
  href,
}: {
  mes: string;
  hoy: string;
  seleccionado: string | null;
  marcas: Record<string, MarcaDia>;
  href: (q: { mes: string; dia?: string }) => string;
}) {
  const semanas = semanasDelMes(mes);
  const mesHoy = hoy.slice(0, 7);

  return (
    <section className={`${clases.tarjeta} p-3 sm:p-5`} aria-label={`Calendario de ${nombreMes(mes)}`}>
      <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
        <h2 className="font-display text-lg text-titulo capitalize sm:text-xl">{nombreMes(mes)}</h2>
        <div className="flex items-center gap-1.5">
          {mes !== mesHoy && (
            <Link href={href({ mes: mesHoy, dia: hoy })} className={`${clases.botonSecundario} px-3 py-1.5 text-xs`}>
              Hoy
            </Link>
          )}
          <Link href={href({ mes: sumarMeses(mes, -1) })} className={flecha} aria-label="Mes anterior">
            <IconoAccion accion="volver" />
          </Link>
          <Link href={href({ mes: sumarMeses(mes, 1) })} className={flecha} aria-label="Mes siguiente">
            <IconoAccion accion="siguiente" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold tracking-wide text-texto-suave uppercase sm:gap-1.5">
        {DIAS_CORTOS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
        {semanas.flat().map(({ fecha, delMes }) => {
          const marca = marcas[fecha];
          const activo = fecha === seleccionado;
          const esHoy = fecha === hoy;
          return (
            <Link
              key={fecha}
              href={href({ mes, dia: fecha })}
              scroll={false}
              aria-current={activo ? "date" : undefined}
              aria-label={`${Number(fecha.slice(8))}${marca ? `: ${marca.texto}` : ""}`}
              className={`flex aspect-square flex-col items-center justify-start rounded-lg border p-1 text-sm transition sm:aspect-auto sm:min-h-20 sm:items-stretch sm:p-2 ${
                activo
                  ? "border-primario ring-2 ring-anillo"
                  : marca?.tono === "ocupado"
                    ? "border-transparent bg-activo hover:border-borde-campo"
                    : marca?.tono === "parcial"
                      ? "border-transparent bg-oro-300/20 hover:border-borde-campo dark:bg-oro-700/20"
                      : "border-transparent hover:border-borde hover:bg-superficie-2"
              } ${delMes ? "" : "opacity-40"}`}
            >
              <span
                className={`flex size-7 items-center justify-center rounded-full text-sm sm:self-start ${
                  esHoy ? "bg-primario font-semibold text-primario-texto" : activo ? "font-semibold text-titulo" : "text-texto"
                }`}
              >
                {Number(fecha.slice(8))}
              </span>
              {marca && (
                <>
                  <span aria-hidden className={`mt-auto mb-0.5 size-1.5 rounded-full sm:hidden ${marca.tono === "ocupado" ? "bg-primario" : "bg-oro-500"}`} />
                  <span className="mt-auto hidden truncate text-left text-[11px] leading-tight font-medium text-titulo sm:block">{marca.texto}</span>
                </>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-suave">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-activo ring-1 ring-borde-campo/60" /> Ocupado todo el día
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-oro-300/40 ring-1 ring-oro-300/60 dark:bg-oro-700/40" /> Ocupado algunas horas
        </span>
      </div>
    </section>
  );
}
