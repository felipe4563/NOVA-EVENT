import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-display text-4xl text-vino-600">403</p>
      <h1 className="mt-2 font-semibold text-tinta">No tienes permiso para ver esta sección</h1>
      <p className="mt-2 text-sm text-tinta-suave">Si crees que es un error, pide acceso a un administrador.</p>
      <Link href="/panel" className="mt-6 inline-block text-sm font-medium text-agua-700 hover:text-vino-600">
        Volver al panel
      </Link>
    </div>
  );
}
