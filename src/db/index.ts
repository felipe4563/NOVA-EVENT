import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

// La conexión se abre en la primera consulta, así que el build no necesita base de datos.
function createClient() {
  return postgres(process.env.DATABASE_URL ?? "", { max: 10 });
}

// En desarrollo se reutiliza la conexión entre recargas en caliente.
const client = globalForDb.pg ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema });
export { schema };
