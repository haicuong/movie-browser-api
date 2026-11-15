import dotenv from "dotenv";
import { defineConfig } from "@neon/config/v1";
import { parseEnv } from "@neon/env";
import { PrismaClient } from "./generated/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

// Keep policy local to src/ so tsconfig rootDir ("./src") stays intact.
const neonPolicy = defineConfig({ auth: false });
const { postgres } = parseEnv(neonPolicy, ["DATABASE_URL"]);

const adapter = new PrismaPg({ connectionString: postgres.databaseUrl });

export const prisma = new PrismaClient({ adapter });
