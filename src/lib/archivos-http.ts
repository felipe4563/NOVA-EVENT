import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { TIPOS_CONTENIDO, rutaSegura } from "@/lib/archivos";

/**
 * Responde con un archivo subido, con soporte de rangos (206/416).
 * No revisa permisos: quien la llama ya decidió que la persona puede verlo.
 * 404 si la clave no es válida o el archivo no existe.
 */
export async function responderArchivo(request: Request, clave: string): Promise<Response> {
  const archivo = rutaSegura(clave);
  if (!archivo) return new Response("No encontrado", { status: 404 });
  const info = await stat(archivo).catch(() => null);
  if (!info?.isFile()) return new Response("No encontrado", { status: 404 });

  const cabeceras: Record<string, string> = {
    "Content-Type": TIPOS_CONTENIDO[clave.split(".").pop()!] ?? "application/octet-stream",
    // Nombre único que nunca cambia: el navegador lo guarda un día (privado, no en servidores intermedios).
    "Cache-Control": "private, max-age=86400",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };

  // Rangos: permiten adelantar un audio sin descargarlo entero.
  const rango = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (rango && (rango[1] || rango[2])) {
    const inicio = rango[1] ? Number(rango[1]) : Math.max(0, info.size - Number(rango[2]));
    const fin = rango[1] && rango[2] ? Math.min(Number(rango[2]), info.size - 1) : info.size - 1;
    if (inicio > fin || inicio >= info.size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    }
    const cuerpo = Readable.toWeb(createReadStream(archivo, { start: inicio, end: fin })) as ReadableStream;
    return new Response(cuerpo, {
      status: 206,
      headers: { ...cabeceras, "Content-Range": `bytes ${inicio}-${fin}/${info.size}`, "Content-Length": String(fin - inicio + 1) },
    });
  }

  const cuerpo = Readable.toWeb(createReadStream(archivo)) as ReadableStream;
  return new Response(cuerpo, { headers: { ...cabeceras, "Content-Length": String(info.size) } });
}
