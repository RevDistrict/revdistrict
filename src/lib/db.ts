import "server-only";
import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";

let pool: pg.Pool | undefined;
export function getPool() {
  const connectionString = process.env.RD_DATABASE_URL;
  if (!connectionString) return undefined;
  if (!pool) {
    // Short idle timeout plus attachDatabasePool closes idle connections before Vercel suspends the instance.
    pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 5000 });
    attachDatabasePool(pool);
  }
  return pool;
}
