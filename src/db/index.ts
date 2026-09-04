import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

import { env } from "@/env";

let connectionString = env.DATABASE_URL;

if (process.env.E2E_TEST === 'true' && process.env.TEST_PARALLEL_INDEX !== undefined) {
  const url = new URL(connectionString);
  url.pathname = `/test_db_worker_${process.env.TEST_PARALLEL_INDEX}`;
  connectionString = url.toString();
}

const postgresOptions: postgres.Options<any> = { prepare: false };

// Disable prefetch in serverless/Next.js environments
export const client = postgres(connectionString, postgresOptions);

export const db = drizzle(client, { schema });

export type DB = typeof db;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
