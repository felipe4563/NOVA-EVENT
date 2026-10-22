/**
 * Datos iniciales: roles base y el primer administrador.
 * Es seguro ejecutarlo varias veces: no sobrescribe lo que ya existe.
 *   npm run db:seed
 */
import bcrypt from "bcryptjs";
import { eq, like } from "drizzle-orm";
import { db } from "./index";
import { eventTypes, novaPackages, rolePermissions, roles, supplierCategories, users } from "./schema";
import { isPermission, type Permission } from "../lib/permissions";

type RoleSeed = {
  key: string;
  name: string;
  description: string;
  kind: "staff" | "provider" | "client";
  fullAccess?: boolean;
  permissions: Permission[];
};

/** Ver, crear, editar y eliminar en un módulo. */
function todo(modulo: string) {
  return (["ver", "crear", "editar", "eliminar"] as const).map((a) => `${modulo}.${a}` as Permission);
}

const ROLES: RoleSeed[] = [
  {
    key: "administrador",
    name: "Administrador",
    description: "Acceso total al sistema, incluidos usuarios, contratos y saldos.",
    kind: "staff",
    fullAccess: true,
    permissions: [],
  },
  {
    key: "coordinador",
    name: "Coordinador",
    description: "Empleado que organiza eventos: cronogramas, proveedores y calendario. Sin acceso a dinero ni usuarios.",
    kind: "staff",
    permissions: [
      "dashboard.ver",
      "proveedores.ver",
      ...todo("cronograma-interno"),
      ...todo("cronograma-evento"),
      ...todo("moodboard"),
      "calendario.ver",
    ],
  },
  {
    key: "proveedor",
    name: "Proveedor",
    description: "Solo ve y edita su propia disponibilidad.",
    kind: "provider",
    permissions: ["dashboard.ver", ...todo("calendario")],
  },
  {
    key: "cliente",
    name: "Cliente",
    description: "Acceso opcional de los novios a su propio evento.",
    kind: "client",
    permissions: ["dashboard.ver"],
  },
];

/** El antiguo permiso "<modulo>.gestionar" (crear y editar) pasa a ser crear + editar + eliminar. */
async function migrarGestionar() {
  const viejos = await db.select().from(rolePermissions).where(like(rolePermissions.permission, "%.gestionar"));
  if (!viejos.length) return;
  await db.transaction(async (tx) => {
    const nuevos = viejos.flatMap(({ roleId, permission }) => {
      const modulo = permission.slice(0, -".gestionar".length);
      return ["crear", "editar", "eliminar"].map((a) => `${modulo}.${a}`).filter(isPermission).map((p) => ({ roleId, permission: p }));
    });
    if (nuevos.length) await tx.insert(rolePermissions).values(nuevos).onConflictDoNothing();
    await tx.delete(rolePermissions).where(like(rolePermissions.permission, "%.gestionar"));
  });
  console.log(`✓ Permisos actualizados: ${viejos.length} "crear y editar" → crear, editar y eliminar`);
}

/** Rubros iniciales; solo se cargan si no hay ninguno (después se administran desde la app). */
const CATEGORIAS = [
  "Salón o lugar",
  "Catering",
  "Música y DJ",
  "Fotografía y video",
  "Decoración y flores",
  "Torta y repostería",
  "Bebidas y bar",
  "Mobiliario y carpas",
  "Iluminación y sonido",
  "Maquillaje y peinado",
  "Vestidos y trajes",
  "Animación y show",
  "Transporte",
  "Otros",
];

async function categorias() {
  const [hay] = await db.select({ id: supplierCategories.id }).from(supplierCategories).limit(1);
  if (hay) return console.log("· Categorías de proveedores ya existen");
  await db.insert(supplierCategories).values(CATEGORIAS.map((name, i) => ({ name, sortOrder: i })));
  console.log(`✓ Categorías de proveedores creadas: ${CATEGORIAS.length}`);
}

/** Tipos de evento iniciales; solo si no hay ninguno. */
const TIPOS_EVENTO = ["Boda", "Quinceaños", "Corporativo", "Cumpleaños", "Otro"];

async function tiposEvento() {
  const [hay] = await db.select({ id: eventTypes.id }).from(eventTypes).limit(1);
  if (hay) return console.log("· Tipos de evento ya existen");
  await db.insert(eventTypes).values(TIPOS_EVENTO.map((name, i) => ({ name, sortOrder: i })));
  console.log(`✓ Tipos de evento creados: ${TIPOS_EVENTO.length}`);
}

const INCLUYE_ESENCIA = [
  "Reunión inicial con los novios.",
  "Planificación básica del evento.",
  "Elaboración del cronograma general.",
  "Coordinación básica con proveedores contratados.",
  "Coordinación del montaje.",
  "Ensayo de la ceremonia.",
  "Coordinación del programa de la boda.",
  "Coordinación de los momentos principales del evento.",
  "Supervisión del cumplimiento del cronograma.",
  "Acompañamiento y coordinación durante el evento.",
];

const INCLUYE_INSPIRACION = [
  "Reuniones de planificación personalizadas.",
  "Asesoría durante todo el proceso.",
  "Organización y seguimiento del presupuesto.",
  "Búsqueda y recomendación de proveedores.",
  "Solicitud y comparación de cotizaciones.",
  "Revisión y seguimiento de contratos.",
  "Coordinación y seguimiento de proveedores.",
  "Elaboración de cronograma detallado.",
  "Organización de horarios y logística.",
  "Coordinación de decoración.",
  "Coordinación de sonido e iluminación.",
  "Coordinación de recepción y orientación de invitados.",
  "Control y seguimiento del programa del evento.",
  "Coordinación integral durante la boda.",
];

const INCLUYE_PRESTIGIO = [
  "Planificación integral desde cero.",
  "Reuniones de planificación personalizadas (incluye hasta 5 reuniones).",
  "Seguimiento continuo de todo el proceso.",
  "Organización y control completo del presupuesto.",
  "Gestión integral de proveedores.",
  "Seguimiento de contratos y pagos.",
  "Coordinación integral de decoración.",
  "Coordinación y supervisión de sonido e iluminación.",
  "Supervisión completa del montaje.",
  "Coordinación de horarios, accesos y logística.",
  "Atención y orientación de invitados.",
  "Cronograma maestro del evento.",
  "Coordinación completa del programa.",
  "Atención personalizada a los novios.",
  "Kit de emergencia para los novios.",
  "Planner exclusivo para los novios.",
  "Coordinación con familiares y personas designadas.",
  "Supervisión del desmontaje.",
  "Supervisión y coordinación hasta finalizar el evento.",
  "Organización completa de principio a fin.",
];

/** Paquetes de Nova Event; solo si no hay ninguno. Cada uno hereda del anterior. */
const PAQUETES_NOVA = [
  {
    name: "Esencia",
    priceCents: 400000,
    theme: "agua",
    base: null,
    tagline: "Lo esencial para que disfrutes tu gran día.",
    description:
      "Pensado para parejas que ya tienen buena parte de su boda organizada, pero desean contar con profesionales que les ayuden a ordenar, coordinar y supervisar los detalles importantes.",
    includes: INCLUYE_ESENCIA,
  },
  {
    name: "Inspiración",
    priceCents: 600000,
    theme: "vino",
    base: "Esencia",
    tagline: "Más planificación, más tranquilidad.",
    description:
      "Para parejas que desean disfrutar del proceso sin tener que encargarse de cada detalle. NOVA EVENTS las acompaña durante la planificación y se encarga de coordinar proveedores, presupuesto y logística.",
    includes: INCLUYE_INSPIRACION,
  },
  {
    name: "Prestigio",
    priceCents: 800000,
    theme: "oro",
    base: "Inspiración",
    tagline: "Tu boda, completamente en nuestras manos.",
    description:
      "Nuestra experiencia más completa. Diseñado para parejas que quieren delegar la organización y disfrutar cada momento, teniendo a NOVA EVENTS pendiente de todo, desde la planificación inicial hasta el último detalle del evento.",
    includes: INCLUYE_PRESTIGIO,
  },
] as const;

async function paquetesNova() {
  const [hay] = await db.select({ id: novaPackages.id }).from(novaPackages).limit(1);
  if (hay) return console.log("· Paquetes de Nova Event ya existen");
  await db.transaction(async (tx) => {
    const ids = new Map<string, string>();
    for (const [i, p] of PAQUETES_NOVA.entries()) {
      const [creado] = await tx
        .insert(novaPackages)
        .values({
          name: p.name,
          priceCents: p.priceCents,
          theme: p.theme,
          tagline: p.tagline,
          description: p.description,
          includes: [...p.includes],
          basePackageId: p.base ? ids.get(p.base) : null,
          sortOrder: i,
        })
        .returning({ id: novaPackages.id });
      ids.set(p.name, creado.id);
    }
  });
  console.log(`✓ Paquetes de Nova Event creados: ${PAQUETES_NOVA.length}`);
}

async function main() {
  await migrarGestionar();
  await categorias();
  await tiposEvento();
  await paquetesNova();
  for (const r of ROLES) {
    const [created] = await db
      .insert(roles)
      .values({
        key: r.key,
        name: r.name,
        description: r.description,
        kind: r.kind,
        fullAccess: r.fullAccess ?? false,
        isSystem: true,
      })
      .onConflictDoNothing({ target: roles.key })
      .returning({ id: roles.id });

    // Los permisos solo se cargan al crear el rol, para no pisar cambios hechos después.
    if (created && r.permissions.length) {
      await db.insert(rolePermissions).values(r.permissions.map((permission) => ({ roleId: created.id, permission })));
    }
    console.log(created ? `✓ Rol creado: ${r.name}` : `· Rol ya existe: ${r.name}`);
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrador";
  if (!email || !password) {
    console.log("· ADMIN_EMAIL / ADMIN_PASSWORD no definidos: no se crea administrador.");
    return;
  }
  if (password.length < 8) throw new Error("ADMIN_PASSWORD debe tener al menos 8 caracteres.");

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    console.log(`· Administrador ya existe: ${email}`);
    return;
  }

  const [adminRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, "administrador"));
  await db.insert(users).values({
    email,
    name,
    passwordHash: await bcrypt.hash(password, 12),
    roleId: adminRole.id,
  });
  console.log(`✓ Administrador creado: ${email}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
