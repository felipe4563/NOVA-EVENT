import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, rolePermissions, roles, sessions, users } from "@/db/schema";
import { hasPermission, type Permission } from "@/lib/permissions";

export const SESSION_COOKIE = "nova_session";
const SESSION_DAYS = 7;

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: { key: string; name: string; kind: "staff" | "provider" | "client" };
  fullAccess: boolean;
  permissions: ReadonlySet<string>;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieSecure() {
  const flag = process.env.COOKIE_SECURE;
  if (flag !== undefined) return flag === "true";
  return process.env.NODE_ENV === "production";
}

export async function getClientInfo() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent") };
}

/** Crea la sesión en la base de datos y deja la cookie. Solo en Server Actions. */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const { ip, userAgent } = await getClientInfo();

  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt, ip, userAgent });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    expires: expiresAt,
  });
}

/** Borra la sesión actual. Solo en Server Actions. */
export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

/** Usuario de la sesión actual, o null. Se consulta una sola vez por petición. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      active: users.active,
      roleId: roles.id,
      roleKey: roles.key,
      roleName: roles.name,
      roleKind: roles.kind,
      fullAccess: roles.fullAccess,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, sql`now()`)))
    .limit(1);

  if (!row || !row.active) return null;

  const perms = row.fullAccess
    ? []
    : await db
        .select({ permission: rolePermissions.permission })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, row.roleId));

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: { key: row.roleKey, name: row.roleName, kind: row.roleKind },
    fullAccess: row.fullAccess,
    permissions: new Set(perms.map((p) => p.permission)),
  };
});

/** Exige una sesión válida; si no la hay, manda al login. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Exige un permiso concreto; si falta, responde 403. */
export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!hasPermission(user, permission)) forbidden();
  return user;
}

export async function audit(entry: {
  action: string;
  userId?: string | null;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  const { ip } = await getClientInfo();
  await db.insert(auditLogs).values({ ...entry, ip });
}
