import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("ifp-dev-2026", 12);
  await db.user.upsert({
    where: { email: "erick.ramos@familiaponcio.org.br" },
    update: {},
    create: {
      email: "erick.ramos@familiaponcio.org.br",
      name: "Erick Ramos",
      hashedPassword: password,
    },
  });
  console.log("Seeded user erick.ramos");
}

main().finally(() => db.$disconnect());
