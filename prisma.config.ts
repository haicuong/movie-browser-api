import dotenv from "dotenv";
import { defineConfig } from "prisma/config";
import { parseEnv } from "@neon/env";
import neonConfig from "./neon.js";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

// Migrations require a direct (non-pooled) Neon connection string.
const { postgres } = parseEnv(neonConfig, ["DATABASE_URL_UNPOOLED"]);

export default defineConfig({
  schema: "src/prisma/schema.prisma",
  migrations: {
    path: "src/prisma/migrations",
  },
  datasource: {
    url: postgres.databaseUrlUnpooled,
  },
});
