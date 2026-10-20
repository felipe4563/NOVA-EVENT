import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { MODULES, hasPermission } from "@/lib/permissions";
import { logout } from "@/app/login/actions";
import { Sidebar } from "./sidebar";

// El panel es privado: cada página valida la sesión en el servidor, así que se renderiza al momento.
export const instant = false;

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = MODULES.filter((m) => hasPermission(user, `${m.key}.ver`)).map(({ key, label, href }) => ({
    key,
    label,
    href,
  }));

  return (
    <div className="flex min-h-dvh flex-1 flex-col md:flex-row">
      <Sidebar
        items={items}
        user={{ name: user.name, role: user.role.name }}
        logoutSlot={
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-lg border border-vino-200 px-3 py-2 text-left text-sm text-vino-600 transition hover:bg-vino-50"
            >
              Cerrar sesión
            </button>
          </form>
        }
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">{children}</main>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col md:flex-row" aria-busy="true">
      <div className="h-16 bg-white/70 md:h-auto md:w-64 md:border-r md:border-marfil" />
      <div className="flex-1 px-4 py-6 md:px-10 md:py-10">
        <div className="h-8 w-56 animate-pulse rounded bg-marfil" />
        <div className="mt-4 h-4 w-80 max-w-full animate-pulse rounded bg-marfil" />
      </div>
    </div>
  );
}
