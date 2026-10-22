import { readFile, stat } from "node:fs/promises";
import { ARCHIVOS_MARCA, esArchivoMarca, rutasMarca } from "@/lib/archivos";

/**
 * Logos e íconos de la empresa, públicos (los usa también la pantalla de inicio de sesión).
 * Entrega el que se subió en Ajustes de la empresa o, si no hay, el original de la app.
 * El navegador pregunta cada vez si cambió (ETag), así un logo nuevo se ve al instante.
 */
export async function GET(request: Request, ctx: RouteContext<"/marca/[archivo]">) {
  const { archivo } = await ctx.params;
  if (!esArchivoMarca(archivo)) return new Response("No encontrado", { status: 404 });

  const { subida, respaldo } = rutasMarca(archivo);
  const ruta = (await stat(subida).catch(() => null))?.isFile() ? subida : respaldo;
  const info = await stat(ruta).catch(() => null);
  if (!info?.isFile()) return new Response("No encontrado", { status: 404 });

  const etag = `"${info.size.toString(36)}-${Math.round(info.mtimeMs).toString(36)}"`;
  const cabeceras = {
    "Content-Type": ARCHIVOS_MARCA[archivo].tipo,
    "Cache-Control": "public, max-age=0, must-revalidate",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: cabeceras });
  return new Response(new Uint8Array(await readFile(ruta)), { headers: cabeceras });
}
