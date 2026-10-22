/**
 * Cotizaciones de EJEMPLO (solo las usa demo.ts, con SEED_DEMO=true): paquetes de los proveedores de ejemplo,
 * capacidad de los lugares y tres cotizaciones: borrador con dos opciones, enviada con enlace activo y aceptada
 * con 2 de 5 proveedores confirmados. Todo es idempotente: no duplica lo que ya está.
 * Las cotizaciones de ejemplo llevan «[demo]» al inicio de las notas internas; así se encuentran para borrarlas.
 */
import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNotNull, like, sql } from "drizzle-orm";
import { detalleEvento } from "../lib/cotizacion/aceptacion";
import { codigoCotizacion, congelarLinea, listaIncluye } from "../lib/cotizacion/propuesta";
import { db } from "./index";
import { eventTypes, novaPackages, quoteItems, quoteVersions, quotes, supplierBusy, supplierPackages, suppliers } from "./schema";

const MARCA = "[demo]";

type Paq = [nombre: string, bs: number, porPersona?: true, descripcion?: string];

/** Paquetes por proveedor (precios en bolivianos; se guardan en centavos). */
const PAQUETES: Record<string, Paq[]> = {
  "Hacienda Los Sauces": [
    ["Jardín (solo)", 12000, undefined, "Jardín para hasta 350 personas, 8 horas."],
    ["Jardín y salón techado", 18000, undefined, "Jardín y salón techado, estacionamiento y montaje de mesas."],
    ["Exclusivo con capilla", 24000, undefined, "Toda la hacienda, capilla incluida, de la ceremonia al cierre."],
  ],
  "Salón Cristal": [
    ["Salón de gala 6 horas", 9500, undefined, "Salón para 250 personas con mobiliario."],
    ["Salón de gala y pista LED", 13000, undefined, "Incluye pista iluminada y sonido ambiental."],
  ],
  "Jardín del Valle": [
    ["Jardín día completo", 8000, undefined, "Jardín para 150 personas, de 10:00 a 17:00."],
    ["Jardín con carpa", 11500, undefined, "Incluye carpa blanca por si llueve."],
  ],
  "Sabores de la Abuela Catering": [
    ["Menú criollo", 85, true, "Entrada, plato fuerte y postre, con meseros."],
    ["Menú gourmet 3 tiempos", 120, true, "Tres tiempos con meseros y vajilla."],
  ],
  "Gourmet Andino": [
    ["Menú andino 3 tiempos", 110, true, "Cocina de autor con productos andinos."],
    ["Estaciones de autor", 150, true, "Estaciones de comida y cócteles de bienvenida."],
  ],
  "DJ Marco Beats": [
    ["DJ 5 horas", 2500, undefined, "Sonido y música continua."],
    ["DJ, luces y hora loca", 3800, undefined, "Sonido, iluminación y hora loca con accesorios."],
  ],
  "Grupo Sensación": [
    ["Orquesta 3 horas", 5500, undefined, "Ocho músicos en vivo."],
    ["Orquesta 4 horas con sonido", 7200],
  ],
  "Luz y Momento Fotografía": [
    ["Cobertura de fotos 6 horas", 3500],
    ["Fotografía, video y dron", 6800, undefined, "Película corta de la boda y fotos editadas."],
  ],
  "Flores del Sol": [
    ["Arco floral de ceremonia", 3000],
    ["Centros de mesa", 2200],
    ["Decoración floral completa", 5500, undefined, "Arco, ramo, centros de mesa y detalles."],
  ],
  "Detalles Mágicos Deco": [
    ["Decoración temática", 4500],
    ["Decoración y photocall", 6500, undefined, "Incluye mantelería, luces cálidas y photocall."],
  ],
  "Dulce Encanto Pastelería": [
    ["Torta de 3 pisos", 2200],
    ["Torta y mesa de postres", 4200, undefined, "Torta, postres y bocaditos para la mesa dulce."],
  ],
  "Bar Móvil La Barra": [
    ["Barra libre", 85, true, "Bartenders, hielo y barra por 4 horas."],
    ["Coctelería de autor", 130, true],
  ],
  "Studio Bella Novia": [
    ["Maquillaje y peinado de la novia", 900, undefined, "Prueba previa incluida."],
    ["Novia y 4 acompañantes", 2600],
  ],
  "Autos Clásicos Illimani": [["Auto clásico decorado", 1200]],
};

const CAPACIDAD: Record<string, number> = { "Hacienda Los Sauces": 350, "Salón Cristal": 250, "Jardín del Valle": 150 };

type LineaDemo = { proveedor: string; paquete: string };
type VersionDemo = { nombre: string; lineas: LineaDemo[]; nova: string };
type CotizacionDemo = {
  cliente: string;
  telefono: string;
  correo: string;
  tipo: string;
  /** Primer sábado a probar: hoy + estos días (se busca uno donde los proveedores estén libres). */
  diasHasta: number;
  inicio: string;
  fin: string;
  invitados: number;
  presupuestoBs: number | null;
  validaDias: number | null;
  estado: "draft" | "sent" | "accepted";
  versiones: VersionDemo[];
  /** Solo aceptada: proveedores ya confirmados. */
  confirmados?: string[];
};

const COTIZACIONES: CotizacionDemo[] = [
  {
    cliente: "Boda Rojas & Pérez",
    telefono: "+591 70011122",
    correo: "rojas.perez@demo.test",
    tipo: "Boda",
    diasHasta: 60,
    inicio: "16:00",
    fin: "23:30",
    invitados: 180,
    presupuestoBs: 60000,
    validaDias: null,
    estado: "draft",
    versiones: [
      {
        nombre: "Opción económica",
        nova: "Esencia",
        lineas: [
          { proveedor: "Jardín del Valle", paquete: "Jardín día completo" },
          { proveedor: "Sabores de la Abuela Catering", paquete: "Menú criollo" },
          { proveedor: "DJ Marco Beats", paquete: "DJ 5 horas" },
          { proveedor: "Flores del Sol", paquete: "Arco floral de ceremonia" },
        ],
      },
      {
        nombre: "Opción premium",
        nova: "Prestigio",
        lineas: [
          { proveedor: "Hacienda Los Sauces", paquete: "Jardín y salón techado" },
          { proveedor: "Gourmet Andino", paquete: "Menú andino 3 tiempos" },
          { proveedor: "Grupo Sensación", paquete: "Orquesta 3 horas" },
          { proveedor: "Detalles Mágicos Deco", paquete: "Decoración temática" },
          { proveedor: "Dulce Encanto Pastelería", paquete: "Torta de 3 pisos" },
          { proveedor: "Bar Móvil La Barra", paquete: "Barra libre" },
        ],
      },
    ],
  },
  {
    cliente: "Quinceaños de Valeria",
    telefono: "+591 70033344",
    correo: "familia.valeria@demo.test",
    tipo: "Quinceaños",
    diasHasta: 35,
    inicio: "19:00",
    fin: "23:59",
    invitados: 120,
    presupuestoBs: 40000,
    validaDias: 14,
    estado: "sent",
    versiones: [
      {
        nombre: "Opción única",
        nova: "Inspiración",
        lineas: [
          { proveedor: "Salón Cristal", paquete: "Salón de gala 6 horas" },
          { proveedor: "Sabores de la Abuela Catering", paquete: "Menú criollo" },
          { proveedor: "DJ Marco Beats", paquete: "DJ, luces y hora loca" },
          { proveedor: "Dulce Encanto Pastelería", paquete: "Torta de 3 pisos" },
        ],
      },
    ],
  },
  {
    cliente: "Boda García & Mendoza",
    telefono: "+591 70055566",
    correo: "garcia.mendoza@demo.test",
    tipo: "Boda",
    diasHasta: 90,
    inicio: "17:00",
    fin: "23:59",
    invitados: 200,
    presupuestoBs: 80000,
    validaDias: null,
    estado: "accepted",
    confirmados: ["Hacienda Los Sauces", "DJ Marco Beats"],
    versiones: [
      {
        nombre: "Propuesta final",
        nova: "Prestigio",
        lineas: [
          { proveedor: "Hacienda Los Sauces", paquete: "Jardín y salón techado" },
          { proveedor: "Sabores de la Abuela Catering", paquete: "Menú gourmet 3 tiempos" },
          { proveedor: "DJ Marco Beats", paquete: "DJ, luces y hora loca" },
          { proveedor: "Flores del Sol", paquete: "Decoración floral completa" },
          { proveedor: "Luz y Momento Fotografía", paquete: "Fotografía, video y dron" },
        ],
      },
    ],
  },
];

/* Fechas como texto AAAA-MM-DD (este script corre suelto, sin Next). */
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TIMEZONE || "America/La_Paz" }).format(new Date());
function sumarDias(fecha: string, n: number) {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}
const esSabado = (fecha: string) => new Date(`${fecha}T00:00:00Z`).getUTCDay() === 6;

async function cargarPaquetes() {
  const provs = await db.select({ id: suppliers.id, name: suppliers.name, capacity: suppliers.capacity }).from(suppliers).where(inArray(suppliers.name, Object.keys(PAQUETES)));
  let creados = 0;
  for (const p of provs) {
    if (CAPACIDAD[p.name] && p.capacity === null) await db.update(suppliers).set({ capacity: CAPACIDAD[p.name] }).where(eq(suppliers.id, p.id));
    const [tiene] = await db.select({ id: supplierPackages.id }).from(supplierPackages).where(eq(supplierPackages.supplierId, p.id)).limit(1);
    if (tiene) continue;
    await db.insert(supplierPackages).values(
      PAQUETES[p.name].map(([name, bs, porPersona, description], i) => ({
        supplierId: p.id,
        name,
        description: description ?? null,
        priceCents: bs * 100,
        pricing: porPersona ? ("per_person" as const) : ("fixed" as const),
        sortOrder: i,
      })),
    );
    creados += PAQUETES[p.name].length;
  }
  return creados;
}

/**
 * Sábado para el evento. Si hay que confirmar proveedores (estricto), el primero donde todos están libres;
 * si no, entre los próximos 4 sábados el que tenga menos proveedores ocupados (así la fecha queda cerca
 * y, si alguno está ocupado, se ve el aviso de disponibilidad).
 */
async function fechaLibre(desde: string, proveedores: string[], estricto: boolean) {
  let fecha = desde;
  while (!esSabado(fecha)) fecha = sumarDias(fecha, 1);
  let mejor = { fecha, ocupados: Infinity };
  for (let i = 0; i < (estricto ? 30 : 4); i++, fecha = sumarDias(fecha, 7)) {
    const filas = await db
      .select({ id: supplierBusy.supplierId })
      .from(supplierBusy)
      .where(and(inArray(supplierBusy.supplierId, proveedores), eq(supplierBusy.date, fecha)));
    const ocupados = new Set(filas.map((f) => f.id)).size;
    if (ocupados === 0) return fecha;
    if (!estricto && ocupados < mejor.ocupados) mejor = { fecha, ocupados };
  }
  return mejor.fecha;
}

async function crearCotizacion(c: CotizacionDemo) {
  const [existe] = await db.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.clientName, c.cliente), like(quotes.notes, `${MARCA}%`)));
  if (existe) return false;

  const [tipo] = await db.select({ id: eventTypes.id }).from(eventTypes).where(eq(eventTypes.name, c.tipo));
  const nombresProv = [...new Set(c.versiones.flatMap((v) => v.lineas.map((l) => l.proveedor)))];
  const provs = await db.select({ id: suppliers.id, name: suppliers.name, categoryId: suppliers.categoryId }).from(suppliers).where(inArray(suppliers.name, nombresProv));
  const prov = new Map(provs.map((p) => [p.name, p]));
  const nova = new Map((await db.select().from(novaPackages)).map((p) => [p.name, p]));
  if (!tipo || prov.size !== nombresProv.length || c.versiones.some((v) => !nova.has(v.nova))) {
    console.log(`· Faltan datos base: se omite la cotización «${c.cliente}»`);
    return false;
  }
  const paqs = await db.select().from(supplierPackages).where(inArray(supplierPackages.supplierId, provs.map((p) => p.id)));

  const inicio = hoy();
  const fecha = await fechaLibre(sumarDias(inicio, c.diasHasta), provs.map((p) => p.id), c.estado === "accepted");
  const anio = Number(inicio.slice(0, 4));

  await db.transaction(async (tx) => {
    // Correlativo normal del año: no choca con las cotizaciones reales.
    const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${quotes.seq}), 0)` }).from(quotes).where(eq(quotes.year, anio));
    const seq = Number(max) + 1;
    const code = codigoCotizacion(anio, seq);
    const aceptada = c.estado === "accepted";
    const [q] = await tx
      .insert(quotes)
      .values({
        code,
        year: anio,
        seq,
        clientName: c.cliente,
        clientPhone: c.telefono,
        clientEmail: c.correo,
        eventTypeId: tipo.id,
        eventDate: fecha,
        startTime: c.inicio,
        endTime: c.fin,
        guests: c.invitados,
        budgetCents: c.presupuestoBs === null ? null : c.presupuestoBs * 100,
        showBudgetToClient: false,
        validUntil: c.validaDias === null ? null : sumarDias(inicio, c.validaDias),
        notes: `${MARCA} Cotización de ejemplo.`,
        status: c.estado,
        acceptedAt: aceptada ? new Date() : null,
        ...(c.estado === "sent" ? { shareToken: randomBytes(24).toString("base64url"), shareEnabled: true } : {}),
      })
      .returning({ id: quotes.id });

    let primeraVersion: string | null = null;
    for (const [vi, v] of c.versiones.entries()) {
      const np = nova.get(v.nova)!;
      const [ver] = await tx
        .insert(quoteVersions)
        .values({ quoteId: q.id, name: v.nombre, sortOrder: vi, showInProposal: true, novaPackageId: np.id })
        .returning({ id: quoteVersions.id });
      primeraVersion ??= ver.id;

      const lineas: { id: string; proveedor: string; paquete: string; total: number }[] = [];
      for (const [li, l] of v.lineas.entries()) {
        const p = prov.get(l.proveedor)!;
        const paq = paqs.find((x) => x.supplierId === p.id && x.name === l.paquete);
        if (!paq) throw new Error(`Falta el paquete «${l.paquete}» de ${l.proveedor}`);
        const total = paq.pricing === "per_person" ? paq.priceCents * c.invitados : paq.priceCents;
        const [it] = await tx
          .insert(quoteItems)
          .values({
            versionId: ver.id,
            categoryId: p.categoryId,
            supplierId: p.id,
            supplierPackageId: paq.id,
            label: paq.name,
            pricing: paq.pricing,
            unitCents: paq.priceCents,
            totalCents: total,
            sortOrder: li,
          })
          .returning({ id: quoteItems.id });
        lineas.push({ id: it.id, proveedor: l.proveedor, paquete: paq.name, total });
      }

      if (!aceptada) continue;
      // Aceptada: mismas copias congeladas que estado-actions.aceptarVersion.
      const [base] = np.basePackageId ? await tx.select({ name: novaPackages.name }).from(novaPackages).where(eq(novaPackages.id, np.basePackageId)) : [];
      await tx
        .update(quoteVersions)
        .set({ frozen: { nombre: np.name, precio: np.priceCents, frase: np.tagline, incluye: listaIncluye(base?.name ?? null, np.includes) } })
        .where(eq(quoteVersions.id, ver.id));
      for (const l of lineas) {
        const confirmada = c.confirmados?.includes(l.proveedor) ?? false;
        let busyId: string | null = null;
        if (confirmada) {
          const [b] = await tx
            .insert(supplierBusy)
            .values({ supplierId: prov.get(l.proveedor)!.id, date: fecha, startTime: c.inicio, endTime: c.fin, detail: detalleEvento(c.cliente, code), byStaff: true })
            .returning({ id: supplierBusy.id });
          busyId = b.id;
        }
        await tx
          .update(quoteItems)
          .set({
            frozen: congelarLinea({ proveedor: l.proveedor, paquete: l.paquete, etiqueta: l.paquete, total: l.total }),
            confirmation: confirmada ? "confirmed" : "pending",
            busyId,
          })
          .where(eq(quoteItems.id, l.id));
      }
    }
    if (aceptada) await tx.update(quotes).set({ acceptedVersionId: primeraVersion }).where(eq(quotes.id, q.id));
  });
  return true;
}

export async function cargarCotizacionesDemo() {
  const paquetes = await cargarPaquetes();
  let nuevas = 0;
  for (const c of COTIZACIONES) if (await crearCotizacion(c)) nuevas++;
  if (paquetes) console.log(`✓ Paquetes de proveedores de ejemplo: ${paquetes}`);
  console.log(nuevas ? `✓ Cotizaciones de ejemplo cargadas: ${nuevas}` : "· Cotizaciones de ejemplo ya cargadas");
}

/** Borra las cotizaciones de ejemplo y los días ocupados que crearon sus confirmaciones. Antes que los proveedores. */
export async function borrarCotizacionesDemo() {
  const ids = (await db.select({ id: quotes.id }).from(quotes).where(like(quotes.notes, `${MARCA}%`))).map((q) => q.id);
  if (!ids.length) return 0;
  const versiones = db.select({ id: quoteVersions.id }).from(quoteVersions).where(inArray(quoteVersions.quoteId, ids));
  const ocupados = (await db.select({ busyId: quoteItems.busyId }).from(quoteItems).where(and(inArray(quoteItems.versionId, versiones), isNotNull(quoteItems.busyId)))).flatMap((o) => (o.busyId ? [o.busyId] : []));
  if (ocupados.length) await db.delete(supplierBusy).where(inArray(supplierBusy.id, ocupados));
  await db.delete(quotes).where(inArray(quotes.id, ids));
  return ids.length;
}
