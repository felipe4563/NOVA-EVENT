"use server";

import bcrypt from "bcryptjs";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { audit, createSession, destroySession, getCurrentUser } from "@/lib/auth";

export type LoginState = { error?: string; email?: string } | undefined;

const LoginSchema = z.object({
  email: z.email({ error: "Escribe un correo válido" }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Escribe tu contraseña" }),
});

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

// Hash fijo para comparar aunque el correo no exista (evita revelar qué correos existen por el tiempo de respuesta).
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hash("nova-event-dummy", 12));

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const rawEmail = String(formData.get("email") ?? "");
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", email: rawEmail };
  }
  const { email, password } = parsed.data;

  const since = new Date(Date.now() - LOCK_MINUTES * 60 * 1000);
  const [{ failed }] = await db
    .select({ failed: count() })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, "login.fallido"),
        gt(auditLogs.createdAt, since),
        sql`${auditLogs.meta}->>'email' = ${email}`,
      ),
    );
  if (failed >= MAX_FAILED) {
    return {
      error: `Demasiados intentos. Espera ${LOCK_MINUTES} minutos e inténtalo de nuevo.`,
      email,
    };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || !ok || !user.active) {
    await audit({ action: "login.fallido", userId: user?.id, meta: { email } });
    return {
      error: user && ok && !user.active ? "Tu cuenta está desactivada." : "Correo o contraseña incorrectos.",
      email,
    };
  }

  await createSession(user.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await audit({ action: "login.exitoso", userId: user.id });

  redirect("/panel");
}

export async function logout() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit({ action: "logout", userId: user.id });
  redirect("/login");
}
