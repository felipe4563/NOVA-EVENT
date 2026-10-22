import { Suspense } from "react";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { datosEmpresa } from "@/lib/empresa";
import { GROUPS, MODULES, hasPermission } from "@/lib/permissions";
import { logout } from "@/app/login/actions";
import { MENU_COOKIE } from "@/lib/tema";
import { PanelShell } from "./panel-shell";

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
  const plegado = (await cookies()).get(MENU_COOKIE)?.value === "plegado";
  const empresa = await datosEmpresa();
  const items = MODULES.filter((m) => hasPermission(user, `${m.key}.ver`)).map(({ key, label, href, group }) => ({
    key,
    label,
    href,
    group,
  }));

  return (
    <PanelShell
      items={items}
      grupos={GROUPS.map(({ key, label, plano }) => ({ key, label, plano }))}
      user={{ name: user.name, role: user.role.name }}
      plegadoInicial={plegado}
      empresa={empresa.name}
      logout={logout}
    >
      {children}
    </PanelShell>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh flex-1" aria-busy="true">
      <div className="hidden w-[18rem] p-3 md:block"><div className="h-full rounded-2xl bg-menu ring-1 ring-menu-borde" /></div>
      <div className="flex-1">
        <div className="h-16 border-b border-borde" />
        <div className="px-4 py-6 md:px-10 md:py-8">
          <div className="h-8 w-56 animate-pulse rounded bg-superficie-2" />
          <div className="mt-4 h-4 w-80 max-w-full animate-pulse rounded bg-superficie-2" />
        </div>
      </div>
    </div>
  );
}
