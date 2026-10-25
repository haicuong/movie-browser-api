import { prisma } from "./prisma.js";

async function main() {
  const user = await prisma.user.findMany();

  console.dir(user, { depth: null });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
