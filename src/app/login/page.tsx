import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { SelectorTema } from "@/components/selector-tema";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <main className="bg-marmol relative flex min-h-dvh flex-1 flex-col lg:flex-row lg:bg-none">
      <SelectorTema className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-10 sm:right-5" />

      {/* Computadora: logo grande a la izquierda */}
      <section className="bg-marmol hidden items-center justify-center p-12 lg:flex lg:w-[55%] xl:w-3/5">
        <Logo priority sizes="(min-width: 1024px) 520px, 0px" className="w-full max-w-[520px]" />
      </section>

      {/* Formulario: en celular y tablet va centrado, con el logo arriba */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:bg-fondo lg:px-12">
        <div className="lg:hidden">
          <Logo priority sizes="(max-width: 640px) 240px, 360px" className="w-[240px] sm:w-[360px]" />
        </div>

        <div className="mt-4 w-full max-w-sm rounded-2xl bg-superficie/85 p-6 shadow-xl shadow-vino-600/5 ring-1 ring-borde backdrop-blur-sm sm:max-w-md sm:p-8 lg:mt-0 lg:max-w-sm lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0 lg:backdrop-blur-none">
          <p className="text-center text-xs font-medium tracking-[0.3em] text-acento uppercase">Sistema interno</p>
          <h1 className="font-display mt-2 text-center text-2xl text-titulo sm:text-3xl">Bienvenido</h1>
          <div className="mt-3 flex items-center justify-center gap-3" aria-hidden>
            <span className="h-px w-10 bg-oro-500" />
            <span className="text-oro-500">♥</span>
            <span className="h-px w-10 bg-oro-500" />
          </div>
          <p className="mt-4 text-center text-sm text-texto-suave">Ingresa con tu correo y contraseña para continuar.</p>

          <LoginForm />

          <p className="mt-6 text-center text-xs leading-relaxed text-texto-suave">
            ¿Olvidaste tu contraseña? Pide a un administrador de Nova Event que te la restablezca.
          </p>
        </div>
      </section>
    </main>
  );
}
