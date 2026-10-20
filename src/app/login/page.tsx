import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      {/* Celular y tablet: logo arriba */}
      <section className="flex justify-center px-4 pt-8 lg:hidden">
        <Image
          src="/brand/logo.webp"
          alt="Nova Event — Tú sueñas, nosotros lo hacemos realidad"
          width={1280}
          height={1024}
          priority
          className="h-auto w-full max-w-[300px] rounded-2xl shadow-sm"
        />
      </section>

      {/* Computadora: el logo ocupa todo el panel izquierdo */}
      <section className="relative hidden lg:block lg:w-3/5">
        <Image
          src="/brand/logo.webp"
          alt="Nova Event — Tú sueñas, nosotros lo hacemos realidad"
          fill
          priority
          sizes="60vw"
          className="object-cover"
        />
      </section>

      <section className="flex flex-1 items-center justify-center bg-crema px-4 py-10 lg:px-10">
        <div className="w-full max-w-sm">
          <p className="text-xs font-medium tracking-[0.3em] text-oro-700 uppercase">Sistema interno</p>
          <h1 className="font-display mt-2 text-3xl text-vino-600">Bienvenido</h1>
          <div className="mt-3 flex items-center gap-3" aria-hidden>
            <span className="h-px w-10 bg-oro-500" />
            <span className="text-oro-500">♥</span>
            <span className="h-px w-10 bg-oro-500" />
          </div>
          <p className="mt-4 text-sm text-tinta-suave">Ingresa con tu correo y contraseña para continuar.</p>

          <LoginForm />

          <p className="mt-8 text-xs leading-relaxed text-tinta-suave">
            ¿Olvidaste tu contraseña? Pide a un administrador de Nova Event que te la restablezca.
          </p>
        </div>
      </section>
    </main>
  );
}
