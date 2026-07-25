import { prisma } from "./prisma.js";
import { auth } from "./auth.js";

export async function seedDatabase() {
  console.log("Seeding database...");

  // 1. Seed Core Zones
  const zones = [
    {
      id: "iot_lab",
      name: "IoT Lab",
      apiKey: "key_iot_lab_123",
      hazardProfile: "Soldering/wiring fire risk, gas, high occupancy",
    },
    {
      id: "server_room",
      name: "Server Room",
      apiKey: "key_server_room_456",
      hazardProfile: "Electrical fire, AC coolant leak, low occupancy",
    },
    {
      id: "data_science_lab",
      name: "Data Science Lab",
      apiKey: "key_data_science_789",
      hazardProfile: "GPU overheating, moderate occupancy",
    },
  ];

  for (const z of zones) {
    await prisma.zone.upsert({
      where: { id: z.id },
      update: { apiKey: z.apiKey, hazardProfile: z.hazardProfile },
      create: z,
    });
  }
  console.log("Seeded 3 core zones.");

  // 2. Seed Default Users with Passwords via Better Auth API
  const DEFAULT_PASSWORD = "Password123!";

  // Seed Admin User
  const adminAccount = await prisma.account.findFirst({
    where: { user: { email: "admin@uftb.edu.bd" } },
  });

  if (!adminAccount) {
    console.log("Creating Admin account with password...");
    await prisma.account.deleteMany({ where: { user: { email: "admin@uftb.edu.bd" } } });
    await prisma.user.deleteMany({ where: { email: "admin@uftb.edu.bd" } });

    try {
      await auth.api.signUpEmail({
        body: {
          email: "admin@uftb.edu.bd",
          password: DEFAULT_PASSWORD,
          name: "Campus Security Admin",
        },
      });
      await prisma.user.update({
        where: { email: "admin@uftb.edu.bd" },
        data: { role: "admin" },
      });
      console.log("Seeded Admin user (admin@uftb.edu.bd / Password123!)");
    } catch (e: any) {
      console.warn("Could not sign up admin:", e.message);
    }
  }

  // Seed Staff User
  const staffAccount = await prisma.account.findFirst({
    where: { user: { email: "staff@uftb.edu.bd" } },
  });

  if (!staffAccount) {
    console.log("Creating Staff account with password...");
    await prisma.account.deleteMany({ where: { user: { email: "staff@uftb.edu.bd" } } });
    await prisma.user.deleteMany({ where: { email: "staff@uftb.edu.bd" } });

    try {
      await auth.api.signUpEmail({
        body: {
          email: "staff@uftb.edu.bd",
          password: DEFAULT_PASSWORD,
          name: "Security Patrol Staff",
        },
      });
      await prisma.user.update({
        where: { email: "staff@uftb.edu.bd" },
        data: { role: "staff" },
      });
      console.log("Seeded Staff user (staff@uftb.edu.bd / Password123!)");
    } catch (e: any) {
      console.warn("Could not sign up staff:", e.message);
    }
  }

  console.log("Core database seeding complete.");
}
