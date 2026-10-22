/**
 * Datos de EJEMPLO para probar el sistema en desarrollo. Nunca en producción.
 * Solo se ejecuta con SEED_DEMO=true; si no, no hace nada.
 *   npm run db:demo             → carga los ejemplos (no duplica si ya están)
 *   npm run db:demo -- --borrar → quita todos los ejemplos
 * Incluye galerías (imágenes dibujadas y audios de muestra) que se guardan en UPLOADS_DIR.
 * Las cuentas de ejemplo terminan en @demo.test y usan la contraseña DEMO_PASSWORD (por defecto Demo12345).
 */
import bcrypt from "bcryptjs";
import { eq, inArray, like } from "drizzle-orm";
import { borrarCarpetaProveedor } from "../lib/archivos";
import { borrarCotizacionesDemo, cargarCotizacionesDemo } from "./demo-cotizaciones";
import { cargarGalerias } from "./demo-galeria";
import { db } from "./index";
import { companySettings, roles, supplierBusy, supplierCategories, suppliers, users } from "./schema";

const DOMINIO = "@demo.test";

type ProveedorDemo = {
  name: string;
  categoria: string;
  contactName: string;
  phone: string;
  address: string;
  website?: string;
  services: string;
  notes?: string;
  active?: boolean;
  /** Cuenta para que el proveedor entre y marque sus días. */
  cuenta?: { email: string; name: string };
  /** Qué tan ocupado está los fines de semana (0 a 1) y en qué horario. */
  ocupacion: number;
  horario?: [string, string];
};

const PROVEEDORES: ProveedorDemo[] = [
  {
    name: "Hacienda Los Sauces",
    categoria: "Salón o lugar",
    contactName: "Rosario Mendoza",
    phone: "+591 71234501",
    address: "Mallasa, La Paz",
    website: "instagram.com/haciendalossauces.demo",
    services: "Jardín para 350 personas, salón techado para 200, estacionamiento y capilla.",
    notes: "Pide 50 % de anticipo. Muy cumplidos con los horarios.",
    cuenta: { email: "hacienda@demo.test", name: "Rosario Mendoza" },
    ocupacion: 0.7,
  },
  {
    name: "Salón Cristal",
    categoria: "Salón o lugar",
    contactName: "Jorge Quiroga",
    phone: "+591 71234502",
    address: "Calacoto, calle 21",
    services: "Salón de gala para 250 personas con pista iluminada.",
    ocupacion: 0.5,
  },
  {
    name: "Jardín del Valle",
    categoria: "Salón o lugar",
    contactName: "Mariela Rojas",
    phone: "+591 71234503",
    address: "Achumani, La Paz",
    services: "Jardín para 150 personas, ideal para bodas de día.",
    ocupacion: 0.35,
    horario: ["10:00", "17:00"],
  },
  {
    name: "Sabores de la Abuela Catering",
    categoria: "Catering",
    contactName: "Doña Carmen Vargas",
    phone: "+591 71234504",
    address: "Sopocachi, La Paz",
    services: "Menú criollo y gourmet, desde 80 hasta 400 invitados. Incluye meseros.",
    notes: "Excelente relación precio-calidad.",
    ocupacion: 0.6,
  },
  {
    name: "Gourmet Andino",
    categoria: "Catering",
    contactName: "Chef Andrés Paz",
    phone: "+591 71234505",
    address: "San Miguel, La Paz",
    services: "Cocina de autor con productos andinos. Estaciones de comida y cócteles.",
    ocupacion: 0.4,
  },
  {
    name: "DJ Marco Beats",
    categoria: "Música y DJ",
    contactName: "Marco Antonio Ríos",
    phone: "+591 71234506",
    address: "Miraflores, La Paz",
    website: "instagram.com/djmarcobeats.demo",
    services: "DJ con sonido e iluminación para hasta 300 personas. Hora loca incluida.",
    cuenta: { email: "dj@demo.test", name: "Marco Antonio Ríos" },
    ocupacion: 0.65,
    horario: ["19:00", "23:59"],
  },
  {
    name: "Grupo Sensación",
    categoria: "Música y DJ",
    contactName: "Wilson Choque",
    phone: "+591 71234507",
    address: "El Alto",
    services: "Orquesta en vivo de 8 músicos: cumbia, salsa y música boliviana.",
    ocupacion: 0.45,
    horario: ["21:00", "23:59"],
  },
  {
    name: "Luz y Momento Fotografía",
    categoria: "Fotografía y video",
    contactName: "Daniela Ortiz",
    phone: "+591 71234508",
    address: "Obrajes, La Paz",
    services: "Fotografía y video de bodas, sesión preboda y dron.",
    ocupacion: 0.55,
  },
  {
    name: "Flores del Sol",
    categoria: "Decoración y flores",
    contactName: "Patricia Gutiérrez",
    phone: "+591 71234509",
    address: "Mercado de Flores, Max Paredes",
    services: "Arreglos florales, arco de ceremonia, ramo de novia y centros de mesa.",
    ocupacion: 0.5,
    horario: ["07:00", "14:00"],
  },
  {
    name: "Detalles Mágicos Deco",
    categoria: "Decoración y flores",
    contactName: "Verónica Salinas",
    phone: "+591 71234510",
    address: "Irpavi, La Paz",
    services: "Decoración temática, mantelería, iluminación cálida y photocall.",
    ocupacion: 0.3,
  },
  {
    name: "Dulce Encanto Pastelería",
    categoria: "Torta y repostería",
    contactName: "Gabriela Torrez",
    phone: "+591 71234511",
    address: "Sopocachi, La Paz",
    services: "Tortas de boda de 2 a 6 pisos, mesa de postres y bocaditos.",
    cuenta: { email: "pasteleria@demo.test", name: "Gabriela Torrez" },
    ocupacion: 0.5,
    horario: ["08:00", "12:00"],
  },
  {
    name: "Bar Móvil La Barra",
    categoria: "Bebidas y bar",
    contactName: "Luis Fernando Arce",
    phone: "+591 71234512",
    address: "Calacoto, La Paz",
    services: "Barra libre con bartenders, coctelería de autor y chopera.",
    ocupacion: 0.45,
    horario: ["20:00", "23:59"],
  },
  {
    name: "Studio Bella Novia",
    categoria: "Maquillaje y peinado",
    contactName: "Karen Villca",
    phone: "+591 71234513",
    address: "Zona Sur, La Paz",
    services: "Maquillaje y peinado para la novia, madrinas y familia. Prueba previa incluida.",
    ocupacion: 0.4,
    horario: ["06:00", "11:00"],
  },
  {
    name: "Autos Clásicos Illimani",
    categoria: "Transporte",
    contactName: "René Mamani",
    phone: "+591 71234514",
    address: "Villa Fátima, La Paz",
    services: "Autos clásicos decorados para los novios y minibuses para invitados.",
    active: false,
    notes: "Inactivo: dejó de atender temporalmente.",
    ocupacion: 0.2,
  },
];

const EQUIPO = [{ email: "coordinadora@demo.test", name: "Lucía Fernández (demo)", rol: "coordinador" }];

const DETALLES = ["Boda García & Rojas", "Boda Pérez – Salazar", "Quince años de Valeria", "Aniversario de bodas", "Evento corporativo", "Boda civil Mendoza", "Cumpleaños 50"];

/* Fechas como texto AAAA-MM-DD, sin depender de Next (este script corre suelto). */
function hoy() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TIMEZONE || "America/La_Paz" }).format(new Date());
}
function sumarDias(fecha: string, n: number) {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}
function diaSemana(fecha: string) {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
}

/** Número "al azar" pero siempre igual para el mismo texto: los ejemplos no cambian entre cargas. */
function azar(texto: string) {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/** Días ocupados de los próximos 4 meses: sobre todo viernes y sábados, a veces entre semana. */
function agendaDe(p: ProveedorDemo, desde: string) {
  const dias: { date: string; detail: string }[] = [];
  for (let i = 0; i < 120; i++) {
    const fecha = sumarDias(desde, i);
    const dia = diaSemana(fecha);
    const prob = dia === 6 ? p.ocupacion : dia === 5 ? p.ocupacion * 0.6 : dia === 0 ? p.ocupacion * 0.3 : 0.04;
    if (azar(p.name + fecha) < prob) dias.push({ date: fecha, detail: DETALLES[Math.floor(azar(fecha + p.name) * DETALLES.length)] });
  }
  return dias;
}

/** Contacto ficticio de la empresa para ver el pie de las propuestas (solo si aún no se configuró). */
const EMPRESA_DEMO = {
  id: 1,
  name: "Nova Event",
  tagline: "Tú sueñas, nosotros lo hacemos realidad",
  phone: "+591 2 2771234",
  whatsapp: "+591 71234500",
  email: `contacto${DOMINIO}`,
  address: "Av. Ballivián 1234, Calacoto",
  city: "La Paz, Bolivia",
  website: "novaevent.demo.test",
  instagram: "@nova.event.demo",
  facebook: "facebook.com/novaevent.demo",
  tiktok: "@nova.event.demo",
};

async function cargarEmpresa() {
  const r = await db.insert(companySettings).values(EMPRESA_DEMO).onConflictDoNothing({ target: companySettings.id }).returning({ id: companySettings.id });
  if (r.length) console.log("✓ Datos de ejemplo de la empresa (contacto y redes ficticios)");
}

async function cargar() {
  await cargarEmpresa();
  const password = process.env.DEMO_PASSWORD || "Demo12345";
  const hash = await bcrypt.hash(password, 12);
  const categorias = new Map((await db.select().from(supplierCategories)).map((c) => [c.name, c.id]));
  const rolesPorClave = new Map((await db.select().from(roles)).map((r) => [r.key, r.id]));
  const inicio = hoy();
  let nuevos = 0;

  for (const p of PROVEEDORES) {
    const categoryId = categorias.get(p.categoria);
    if (!categoryId) {
      console.log(`· Falta la categoría «${p.categoria}»: se omite ${p.name}`);
      continue;
    }
    const [existe] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, p.name));
    if (existe) continue;

    const [prov] = await db
      .insert(suppliers)
      .values({
        name: p.name,
        categoryId,
        contactName: p.contactName,
        phone: p.phone,
        email: `contacto.${p.name.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "").slice(0, 20)}${DOMINIO}`,
        address: p.address,
        website: p.website ?? null,
        services: p.services,
        notes: p.notes ?? null,
        active: p.active ?? true,
      })
      .returning({ id: suppliers.id });
    nuevos++;

    let creadoPor: string | null = null;
    if (p.cuenta) {
      const [u] = await db
        .insert(users)
        .values({ email: p.cuenta.email, name: p.cuenta.name, passwordHash: hash, roleId: rolesPorClave.get("proveedor")!, supplierId: prov.id })
        .onConflictDoUpdate({ target: users.email, set: { supplierId: prov.id } })
        .returning({ id: users.id });
      creadoPor = u.id;
    }

    // Con cuenta, el proveedor marca sus días (detalle privado); sin cuenta, los registró el equipo.
    const agenda = agendaDe(p, inicio);
    if (agenda.length) {
      await db.insert(supplierBusy).values(
        agenda.map((d) => ({
          supplierId: prov.id,
          date: d.date,
          startTime: p.horario?.[0] ?? null,
          endTime: p.horario?.[1] ?? null,
          detail: p.cuenta ? d.detail : "Avisó por WhatsApp",
          byStaff: !p.cuenta,
          createdById: creadoPor,
        })),
      );
    }
  }

  for (const e of EQUIPO) {
    const roleId = rolesPorClave.get(e.rol);
    if (roleId) await db.insert(users).values({ email: e.email, name: e.name, passwordHash: hash, roleId }).onConflictDoNothing({ target: users.email });
  }

  // Galerías: también para proveedores de ejemplo cargados antes de que existiera la galería.
  const demo = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(inArray(suppliers.name, PROVEEDORES.map((p) => p.name)));
  const archivos = await cargarGalerias(demo);

  await cargarCotizacionesDemo();

  console.log(nuevos ? `✓ Datos de ejemplo cargados: ${nuevos} proveedores` : "· Proveedores de ejemplo ya cargados");
  if (archivos) console.log(`✓ Galerías de ejemplo: ${archivos} fotos, planos, audios y videos`);
  console.log(`  Cuentas de ejemplo (contraseña ${password}): ${[...EQUIPO.map((e) => e.email), ...PROVEEDORES.flatMap((p) => p.cuenta?.email ?? [])].join(", ")}`);
}

async function borrar() {
  // La empresa vuelve a "sin configurar" solo si sigue con el contacto de ejemplo.
  await db.delete(companySettings).where(eq(companySettings.email, EMPRESA_DEMO.email));
  // Las cotizaciones primero: sus días ocupados y líneas apuntan a los proveedores.
  const cotizaciones = await borrarCotizacionesDemo();
  const proveedores = await db.delete(suppliers).where(inArray(suppliers.name, PROVEEDORES.map((p) => p.name))).returning({ id: suppliers.id });
  for (const p of proveedores) await borrarCarpetaProveedor(p.id);
  const cuentas = await db.delete(users).where(like(users.email, `%${DOMINIO}`)).returning({ id: users.id });
  console.log(`✓ Ejemplos borrados: ${cotizaciones} cotizaciones, ${proveedores.length} proveedores y ${cuentas.length} cuentas`);
}

async function main() {
  if (process.env.SEED_DEMO !== "true") {
    console.log("· SEED_DEMO no está en true: no se cargan datos de ejemplo.");
    return;
  }
  if (process.argv.includes("--borrar")) await borrar();
  else await cargar();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
