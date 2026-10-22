"use client";

import { useActionState } from "react";
import { Aviso, Campo, clases } from "@/components/ui";
import { guardarCondiciones } from "../condiciones-actions";

export type CondicionesPago = { adelanto: number | null; dias: number | null; nota: string | null };

const ESTANDAR = "Estándar: 50 % de adelanto y el resto 7 días antes";

/** Texto del resto: «7 días antes del evento», «el mismo día del evento»… */
function textoResto(dias: number) {
  if (dias === 0) return "el mismo día del evento";
  const n = Math.abs(dias);
  return `${n} ${n === 1 ? "día" : "días"} ${dias < 0 ? "antes" : "después"} del evento`;
}

export function CondicionesPagoVista({ supplierId, c, editable }: { supplierId: string; c: CondicionesPago; editable: boolean }) {
  if (editable) return <Formulario supplierId={supplierId} c={c} />;
  const vacio = c.adelanto === null && c.dias === null && !c.nota;
  if (vacio) return <p className="text-sm text-texto-suave">{ESTANDAR}.</p>;
  return (
    <dl className="space-y-1.5 text-sm">
      <div>
        <dt className="inline text-texto-suave">Adelanto: </dt>
        <dd className="inline text-texto">{c.adelanto === null ? "50 % (estándar)" : `${c.adelanto} %`}</dd>
      </div>
      <div>
        <dt className="inline text-texto-suave">El resto se paga: </dt>
        <dd className="inline text-texto">{c.dias === null ? "7 días antes del evento (estándar)" : textoResto(c.dias)}</dd>
      </div>
      {c.nota && (
        <div>
          <dt className="inline text-texto-suave">Nota: </dt>
          <dd className="inline whitespace-pre-line text-texto">{c.nota}</dd>
        </div>
      )}
    </dl>
  );
}

function Formulario({ supplierId, c }: { supplierId: string; c: CondicionesPago }) {
  const [estado, enviar, pendiente] = useActionState(guardarCondiciones.bind(null, supplierId), undefined);
  const e = estado?.errores ?? {};
  const inicial = {
    adelanto: c.adelanto === null ? "" : String(c.adelanto),
    dias: c.dias === null || c.dias === 0 ? "" : String(Math.abs(c.dias)),
    momento: c.dias === 0 ? "mismo" : c.dias !== null && c.dias > 0 ? "despues" : "antes",
    nota: c.nota ?? "",
  };
  const v = { ...inicial, ...estado?.valores };
  return (
    <form action={enviar} noValidate className="space-y-4" key={JSON.stringify(estado ?? null)}>
      {estado?.ok && <Aviso>{estado.ok}</Aviso>}
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <div className="grid gap-4 md:grid-cols-2">
        <Campo id="adelanto" etiqueta="% de adelanto" error={e.adelanto} ayuda="Entero de 0 a 100. Vacío = estándar (50 %).">
          <input id="adelanto" name="adelanto" inputMode="numeric" defaultValue={v.adelanto} aria-invalid={Boolean(e.adelanto) || undefined} className={clases.campo} />
        </Campo>
        <Campo id="dias" etiqueta="El resto se paga" error={e.dias} ayuda="Días y cuándo. Vacío = estándar (7 días antes).">
          <div className="flex gap-2">
            <input
              id="dias"
              name="dias"
              inputMode="numeric"
              placeholder="Días"
              defaultValue={v.dias}
              aria-invalid={Boolean(e.dias) || undefined}
              className={`${clases.campo} w-24 shrink-0`}
            />
            <select name="momento" defaultValue={v.momento} aria-label="Cuándo se paga el resto" className={clases.campo}>
              <option value="antes">antes del evento</option>
              <option value="mismo">el mismo día</option>
              <option value="despues">después del evento</option>
            </select>
          </div>
        </Campo>
      </div>
      <Campo id="nota" etiqueta="Nota (opcional)" error={e.nota}>
        <textarea id="nota" name="nota" defaultValue={v.nota} rows={2} maxLength={300} aria-invalid={Boolean(e.nota) || undefined} className={`${clases.campo} resize-y`} />
      </Campo>
      <div className="flex justify-end">
        <button type="submit" disabled={pendiente} className={clases.botonPrimario}>
          {pendiente ? "Guardando…" : "Guardar condiciones"}
        </button>
      </div>
    </form>
  );
}
