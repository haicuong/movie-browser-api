import { afterAll, beforeAll } from "vitest";
import { prisma } from "../prisma/prisma.js";

beforeAll(() => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      `Refusing to run tests when NODE_ENV="${process.env.NODE_ENV}". Expected "test".`,
    );
  }

  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl || dbUrl.includes("neon.tech")) {
    throw new Error(
      "Refusing to run tests against a Neon/remote database. Check .env.test DATABASE_URL.",
    );
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
