import { PrismaClient } from "../src/app/generated/prisma/client.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Seed Zones
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

  // 2. Seed Default Users
  await prisma.user.upsert({
    where: { email: "admin@uftb.edu.bd" },
    update: { role: "admin" },
    create: {
      id: "usr_admin_001",
      name: "Campus Security Admin",
      email: "admin@uftb.edu.bd",
      emailVerified: true,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.user.upsert({
    where: { email: "staff@uftb.edu.bd" },
    update: { role: "staff" },
    create: {
      id: "usr_staff_001",
      name: "Security Patrol Staff",
      email: "staff@uftb.edu.bd",
      emailVerified: true,
      role: "staff",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  console.log("Seeded admin & staff users.");

  // 3. Seed 10,000+ historical reading rows for Test 19
  console.log("Generating 10,000 historical reading rows...");
  const readingBatch: any[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 1; i <= 10000; i++) {
    const zoneId = zones[i % zones.length].id;
    const pastTime = new Date(now - Math.floor(Math.random() * 30 * dayMs));
    const isCritical = i % 100 === 0;
    const isWarning = !isCritical && i % 20 === 0;

    readingBatch.push({
      zoneId,
      seq: i,
      flameRaw: isCritical ? 850 : 100,
      gasRaw: isWarning ? 600 : 200,
      waterRaw: isWarning ? 500 : 150,
      motion: Math.random() > 0.5,
      riskScore: isCritical ? 78.5 : isWarning ? 45.0 : 12.0,
      state: isCritical ? "CRITICAL" : isWarning ? "WARNING" : "SAFE",
      recordedAt: pastTime,
      receivedAt: pastTime,
    });

    if (readingBatch.length >= 2000) {
      await prisma.reading.createMany({
        data: readingBatch,
        skipDuplicates: true,
      });
      readingBatch.length = 0;
    }
  }

  if (readingBatch.length > 0) {
    await prisma.reading.createMany({
      data: readingBatch,
      skipDuplicates: true,
    });
  }

  console.log("Successfully seeded 10,000+ readings!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
