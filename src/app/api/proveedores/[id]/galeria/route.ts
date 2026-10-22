import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { supplierMedia, suppliers } from "@/db/schema";
import { type ArchivoGuardado, ErrorArchivo, MAX_AUDIO, MAX_IMAGEN, borrarArchivos, guardarAudio, guardarImagen } from "@/lib/archivos";
import { audit, getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

const tipos = ["photo", "plan", "pano", "audio"] as const;
const texto = (max: number) => z.string().trim().max(max);

function error(mensaje: string, status = 400) {
  return Response.json({ error: mensaje }, { status });
}

/** Sube un archivo a la galería de un proveedor (uno por petición, para mostrar el avance de cada uno). */
export async function POST(request: Request, ctx: RouteContext<"/api/proveedores/[id]/galeria">) {
  // Solo desde el propio sistema (como hacen las Server Actions).
  const origen = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origen || !host || URL.parse(origen)?.host !== host) return error("Petición no permitida.", 403);

  const yo = await getCurrentUser();
  if (!yo) return error("Tu sesión terminó. Vuelve a iniciar sesión.", 401);
  if (yo.role.kind !== "staff" || !hasPermission(yo, "proveedores.editar")) return error("No tienes permiso para cambiar la galería.", 403);

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return error("Proveedor no válido.", 404);
  const [prov] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, id));
  if (!prov) return error("Este proveedor ya no existe.", 404);

  const form = await request.formData().catch(() => null);
  const archivo = form?.get("archivo");
  const datos = z
    .object({ tipo: z.enum(tipos), titulo: texto(120), album: texto(60) })
    .safeParse({ tipo: form?.get("tipo"), titulo: form?.get("titulo") ?? "", album: form?.get("album") ?? "" });
  if (!datos.success || !(archivo instanceof File) || archivo.size === 0) return error("Elige un archivo y su tipo.");
  const { tipo, titulo, album } = datos.data;

  const maximo = tipo === "audio" ? MAX_AUDIO : MAX_IMAGEN;
  if (archivo.size > maximo) return error(`«${archivo.name}» pesa más de ${maximo / 1024 / 1024} MB.`, 413);

  const mediaId = randomUUID();
  const buffer = Buffer.from(await archivo.arrayBuffer());
  let guardado: ArchivoGuardado | undefined;
  try {
    guardado = tipo === "audio" ? await guardarAudio(id, mediaId, buffer) : await guardarImagen(id, mediaId, tipo, buffer);
    // Sin título, se usa el nombre del archivo (sin extensión).
    const nombre = titulo || archivo.name.replace(/\.[^.]+$/, "").slice(0, 120);
    await db.insert(supplierMedia).values({ id: mediaId, supplierId: id, kind: tipo, title: nombre || null, album: album || null, createdById: yo.id, ...guardado });
  } catch (e) {
    if (guardado) await borrarArchivos(guardado.fileKey, guardado.thumbKey);
    if (e instanceof ErrorArchivo) return error(`«${archivo.name}»: ${e.message}`, 415);
    console.error(e);
    return error(`No se pudo guardar «${archivo.name}». Intenta de nuevo.`, 500);
  }

  await audit({ action: "galeria.subido", userId: yo.id, entity: "proveedor", entityId: id, meta: { tipo, archivo: archivo.name } });
  return Response.json({ ok: true, id: mediaId });
}
