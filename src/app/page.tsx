import Image from "next/image";
import Link from "next/link";

// Página pública provisional. Aquí irá la web de Nova Event más adelante.
export default function Home() {
  return (
    <main className="bg-marmol flex min-h-dvh flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <Image
        src="/brand/logo.webp"
        alt="Nova Event — Tú sueñas, nosotros lo hacemos realidad"
        width={1280}
        height={1024}
        priority
        className="h-auto w-full max-w-xl mix-blend-multiply"
      />
      <p className="mt-2 text-sm text-tinta-suave">Muy pronto, nuestra página web.</p>
      <Link
        href="/login"
        className="mt-6 rounded-lg bg-vino-600 px-6 py-3 text-sm font-semibold tracking-wide text-white shadow-md shadow-vino-600/20 transition hover:bg-vino-700"
      >
        Ingresar al sistema
      </Link>
    </main>
  );
}
