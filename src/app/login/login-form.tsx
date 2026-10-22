"use client";

import { useActionState, useState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-texto">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state?.email}
          aria-invalid={Boolean(state?.error) || undefined}
          className="mt-1.5 block w-full rounded-lg border border-borde-campo bg-superficie px-3.5 py-2.5 text-base text-texto shadow-sm outline-none transition placeholder:text-texto-suave/60 focus:border-primario focus:ring-3 focus:ring-anillo"
          placeholder="tucorreo@ejemplo.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-texto">
          Contraseña
        </label>
        <div className="relative mt-1.5">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={Boolean(state?.error) || undefined}
            className="block w-full rounded-lg border border-borde-campo bg-superficie py-2.5 pr-12 pl-3.5 text-base text-texto shadow-sm outline-none transition focus:border-primario focus:ring-3 focus:ring-anillo"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-enlace transition hover:text-titulo focus-visible:ring-3 focus-visible:ring-anillo focus-visible:outline-none"
            aria-controls="password"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      <p role="alert" aria-live="polite" className="min-h-5 text-center text-sm text-error">
        {state?.error}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primario px-4 py-3 text-sm font-semibold tracking-wide text-primario-texto shadow-md shadow-vino-600/20 transition hover:bg-primario-hover focus-visible:ring-3 focus-visible:ring-anillo focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
      <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.6M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </svg>
  );
}
