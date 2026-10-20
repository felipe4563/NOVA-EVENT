"use client";

import { useActionState, useState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-tinta">
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
          className="mt-1.5 block w-full rounded-lg border border-rosa-300 bg-white px-3.5 py-2.5 text-base text-tinta shadow-sm outline-none transition placeholder:text-tinta-suave/60 focus:border-vino-500 focus:ring-3 focus:ring-vino-100"
          placeholder="tucorreo@ejemplo.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-tinta">
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
            className="block w-full rounded-lg border border-rosa-300 bg-white py-2.5 pr-20 pl-3.5 text-base text-tinta shadow-sm outline-none transition focus:border-vino-500 focus:ring-3 focus:ring-vino-100"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 px-3.5 text-xs font-medium text-agua-700 hover:text-vino-600"
            aria-controls="password"
            aria-pressed={showPassword}
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-vino-600">
        {state?.error}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-vino-600 px-4 py-3 text-sm font-semibold tracking-wide text-white shadow-md shadow-vino-600/20 transition hover:bg-vino-700 focus-visible:ring-3 focus-visible:ring-vino-200 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
