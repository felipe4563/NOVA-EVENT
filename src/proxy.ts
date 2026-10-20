import { NextResponse, type NextRequest } from "next/server";

// Revisión rápida: sin cookie de sesión no se entra al panel.
// La validación real de la sesión y los permisos se hace en el servidor (src/lib/auth.ts).
export function proxy(request: NextRequest) {
  if (!request.cookies.has("nova_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/panel/:path*"],
};
