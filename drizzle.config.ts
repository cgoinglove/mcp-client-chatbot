import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config();

const dialect = "postgresql";

const url = process.env.POSTGRES_URL!;

const schema = "./src/lib/db/pg/schema.pg.ts";

const out = "./src/lib/db/migrations/pg";

export default defineConfig({
  schema,
  out,
  dialect,
  migrations: {},
  dbCredentials: {
    url,
  },
});
