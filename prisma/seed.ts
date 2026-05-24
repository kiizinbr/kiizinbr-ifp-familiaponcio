import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_DESCRIPTIONS, ROLE_NAMES, GLOBAL_ROLES } from "../src/lib/rbac-types";

const db = new PrismaClient();

async function main() {
  // 1. Seed dos 7 roles (idempotente — upsert)
  for (const name of ROLE_NAMES) {
    await db.role.upsert({
      where: { name },
      update: { description: ROLE_DESCRIPTIONS[name] },
      create: {
        name,
        description: ROLE_DESCRIPTIONS[name],
        scope: GLOBAL_ROLES.includes(name) ? "global" : "unit",
      },
    });
  }
  console.log(`Seeded ${ROLE_NAMES.length} roles`);

  // 2. Seed Erick super_admin
  const password = await bcrypt.hash("ifp-dev-2026", 12);
  const erick = await db.user.upsert({
    where: { email: "erick.ramos@familiaponcio.org.br" },
    update: {
      primaryRoleName: "super_admin",
      primaryUnitScope: null,
    },
    create: {
      email: "erick.ramos@familiaponcio.org.br",
      name: "Erick Ramos",
      hashedPassword: password,
      primaryRoleName: "super_admin",
      primaryUnitScope: null,
    },
  });

  // 3. UserRole Erick × super_admin (idempotente via findFirst + create)
  const superAdminRole = await db.role.findUniqueOrThrow({ where: { name: "super_admin" } });
  const existing = await db.userRole.findFirst({
    where: { userId: erick.id, roleId: superAdminRole.id, unitScope: null },
  });
  if (!existing) {
    await db.userRole.create({
      data: { userId: erick.id, roleId: superAdminRole.id, unitScope: null },
    });
  }
  console.log("Seeded user erick.ramos as super_admin");
}

main().finally(() => db.$disconnect());
