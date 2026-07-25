import { prisma } from "../src/app/config/prisma.js";
import { seedDatabase } from "../src/app/config/seed.js";

seedDatabase()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
