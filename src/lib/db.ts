import "server-only";
import pg from "pg";

let pool: pg.Pool | undefined;
export function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return undefined;
  return (pool ??= new pg.Pool({ connectionString, max: 5 }));
}
