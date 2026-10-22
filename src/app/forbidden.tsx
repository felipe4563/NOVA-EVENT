import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-display text-4xl text-titulo">403</p>
      <h1 className="mt-2 font-semibold text-texto">No tienes permiso para ver esta sección</h1>
      <p className="mt-2 text-sm text-texto-suave">Si crees que es un error, pide acceso a un administrador.</p>
      <Link href="/panel" className="mt-6 inline-block text-sm font-medium text-enlace hover:text-titulo">
        Volver al panel
      </Link>
    </div>
  );
}
