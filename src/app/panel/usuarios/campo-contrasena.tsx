"use client";

import { useState } from "react";
import { IconoAccion } from "@/components/iconos";
import { clases } from "@/components/ui";

/** Genera una contraseña segura y fácil de dictar (sin letras que se confunden como l/1 u O/0). */
function generar() {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const numeros = "23456789";
  const todos = letras + numeros;
  const r = crypto.getRandomValues(new Uint32Array(12));
  const chars = Array.from(r, (n) => todos[n % todos.length]);
  // Garantiza al menos una letra y un número
  chars[0] = letras[r[0] % letras.length];
  chars[5] = numeros[r[5] % numeros.length];
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8).join("")}`;
}

export function CampoContrasena({
  id = "password",
  error,
  valor,
  setValor,
}: {
  id?: string;
  error?: string;
  /** El valor vive en el componente padre para no perderlo cuando el formulario se reinicia. */
  valor: string;
  setValor: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // El navegador no permitió copiar: la contraseña sigue visible para copiarla a mano.
      setVisible(true);
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          autoComplete="new-password"
          required
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${clases.campo} pr-12 font-mono`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-enlace hover:text-titulo"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-5" aria-hidden>
            {visible ? (
              <>
                <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.6M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
              </>
            ) : (
              <>
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setValor(generar());
            setVisible(true);
          }}
          className={`${clases.botonSecundario} px-3 py-1.5 text-xs`}
        >
          <IconoAccion accion="dado" /> Generar una segura
        </button>
        {valor && (
          <button type="button" onClick={copiar} className={`${clases.botonSecundario} px-3 py-1.5 text-xs`}>
            <IconoAccion accion={copiado ? "check" : "copiar"} /> {copiado ? "Copiada" : "Copiar"}
          </button>
        )}
      </div>
    </div>
  );
}
