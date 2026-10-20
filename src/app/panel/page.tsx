import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { MODULES, hasPermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Dashboard" };
export const instant = false;

export default async function DashboardPage() {
  const user = await requirePermission("dashboard.ver");
  const modules = MODULES.filter((m) => m.key !== "dashboard" && hasPermission(user, `${m.key}.ver`));
  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-medium tracking-[0.3em] text-oro-700 uppercase">Dashboard</p>
      <h1 className="font-display mt-2 text-3xl text-vino-600">Hola, {firstName}</h1>
      <p className="mt-2 text-tinta-suave">Este es tu panel de Nova Event. Elige un módulo para empezar.</p>

      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <li key={m.key}>
            <Link
              href={m.href}
              className="block h-full rounded-xl border border-marfil bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-rosa-300 hover:shadow-md"
            >
              <span className="block h-1 w-8 rounded-full bg-gradient-to-r from-vino-500 to-agua-500" aria-hidden />
              <span className="mt-4 block font-semibold text-tinta">{m.label}</span>
              <span className="mt-1 block text-sm text-tinta-suave">Próximamente</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
