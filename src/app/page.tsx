import Link from "next/link";
import { Logo } from "@/components/logo";
import { SelectorTema } from "@/components/selector-tema";

// Página pública provisional. Aquí irá la web de Nova Event más adelante.
export default function Home() {
  return (
    <main className="bg-marmol relative flex min-h-dvh flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <SelectorTema className="absolute top-3 right-3 sm:right-5" />
      <Logo priority sizes="(max-width: 600px) 90vw, 520px" className="w-full max-w-[520px]" />
      <p className="mt-2 text-sm text-texto-suave">Muy pronto, nuestra página web.</p>
      <Link
        href="/login"
        className="mt-6 rounded-lg bg-primario px-6 py-3 text-sm font-semibold tracking-wide text-primario-texto shadow-md shadow-vino-600/20 transition hover:bg-primario-hover"
      >
        Ingresar al sistema
      </Link>
    </main>
  );
}
