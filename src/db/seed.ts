/**
 * Datos iniciales: roles base y el primer administrador.
 * Es seguro ejecutarlo varias veces: no sobrescribe lo que ya existe.
 *   npm run db:seed
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { rolePermissions, roles, users } from "./schema";
import type { Permission } from "../lib/permissions";

type RoleSeed = {
  key: string;
  name: string;
  description: string;
  kind: "staff" | "provider" | "client";
  fullAccess?: boolean;
  permissions: Permission[];
};

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
      "cronograma-interno.ver",
      "cronograma-interno.gestionar",
      "cronograma-evento.ver",
      "cronograma-evento.gestionar",
      "moodboard.ver",
      "moodboard.gestionar",
      "calendario.ver",
    ],
  },
  {
    key: "proveedor",
    name: "Proveedor",
    description: "Solo ve y edita su propia disponibilidad.",
    kind: "provider",
    permissions: ["dashboard.ver", "calendario.ver", "calendario.gestionar"],
  },
  {
    key: "cliente",
    name: "Cliente",
    description: "Acceso opcional de los novios a su propio evento.",
    kind: "client",
    permissions: ["dashboard.ver"],
  },
];

async function main() {
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
