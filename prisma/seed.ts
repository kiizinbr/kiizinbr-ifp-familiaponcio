import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { GLOBAL_ROLES, ROLE_DESCRIPTIONS, ROLE_NAMES } from "../src/lib/rbac-types";
import type { RoleName, UnitScope } from "../src/lib/rbac-types";

const db = new PrismaClient();

interface UserRoleSpec {
  roleName: RoleName;
  unitScope: UnitScope | null;
}

interface DemoUserSpec {
  email: string;
  name: string;
  password: string;
  primaryRoleName: RoleName;
  primaryUnitScope: UnitScope | null;
  roles: UserRoleSpec[];
}

const DEMO_PASSWORD = "ifp-demo-2026";
const ERICK_PASSWORD = "ifp-dev-2026";

const DEMO_USERS: DemoUserSpec[] = [
  {
    email: "raquel.barros@familiaponcio.org.br",
    name: "Raquel Barros",
    password: DEMO_PASSWORD,
    primaryRoleName: "gestor_geral",
    primaryUnitScope: null,
    roles: [
      { roleName: "gestor_geral", unitScope: null },
      { roleName: "gestor_unidade", unitScope: "medico" },
    ],
  },
  {
    email: "luciana@familiaponcio.org.br",
    name: "Luciana",
    password: DEMO_PASSWORD,
    primaryRoleName: "gestor_unidade",
    primaryUnitScope: "capacitacao",
    roles: [{ roleName: "gestor_unidade", unitScope: "capacitacao" }],
  },
  {
    email: "livia@familiaponcio.org.br",
    name: "Livia",
    password: DEMO_PASSWORD,
    primaryRoleName: "gestor_unidade",
    primaryUnitScope: "esportivo",
    roles: [{ roleName: "gestor_unidade", unitScope: "esportivo" }],
  },
  {
    email: "danielle@familiaponcio.org.br",
    name: "Danielle",
    password: DEMO_PASSWORD,
    primaryRoleName: "gestor_unidade",
    primaryUnitScope: "recreativo",
    roles: [{ roleName: "gestor_unidade", unitScope: "recreativo" }],
  },
  {
    email: "regina@familiaponcio.org.br",
    name: "Regina",
    password: DEMO_PASSWORD,
    primaryRoleName: "social",
    primaryUnitScope: null,
    roles: [{ roleName: "social", unitScope: null }],
  },
  {
    email: "maria.callcenter@familiaponcio.org.br",
    name: "Maria Silva",
    password: DEMO_PASSWORD,
    primaryRoleName: "recepcao",
    primaryUnitScope: "medico",
    roles: [{ roleName: "recepcao", unitScope: "medico" }],
  },
  {
    email: "saulo@familiaponcio.org.br",
    name: "Saulo Pôncios",
    password: DEMO_PASSWORD,
    primaryRoleName: "presidencia",
    primaryUnitScope: null,
    roles: [{ roleName: "presidencia", unitScope: null }],
  },
  {
    email: "simone@familiaponcio.org.br",
    name: "Simone Pôncios",
    password: DEMO_PASSWORD,
    primaryRoleName: "presidencia",
    primaryUnitScope: null,
    roles: [{ roleName: "presidencia", unitScope: null }],
  },
];

async function seedRoles() {
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
}

async function ensureUserRole(userId: string, roleName: RoleName, unitScope: UnitScope | null) {
  const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
  const existing = await db.userRole.findFirst({
    where: { userId, roleId: role.id, unitScope },
  });
  if (!existing) {
    await db.userRole.create({
      data: { userId, roleId: role.id, unitScope },
    });
  }
}

async function seedUser(spec: {
  email: string;
  name: string;
  password: string;
  primaryRoleName: RoleName;
  primaryUnitScope: UnitScope | null;
  roles: UserRoleSpec[];
}) {
  const hashedPassword = await bcrypt.hash(spec.password, 12);
  const user = await db.user.upsert({
    where: { email: spec.email },
    update: {
      name: spec.name,
      primaryRoleName: spec.primaryRoleName,
      primaryUnitScope: spec.primaryUnitScope,
    },
    create: {
      email: spec.email,
      name: spec.name,
      hashedPassword,
      primaryRoleName: spec.primaryRoleName,
      primaryUnitScope: spec.primaryUnitScope,
    },
  });
  for (const r of spec.roles) {
    await ensureUserRole(user.id, r.roleName, r.unitScope);
  }
  return user;
}

async function main() {
  await seedRoles();

  // Erick = super_admin (senha diferente, conta principal)
  await seedUser({
    email: "erick.ramos@familiaponcio.org.br",
    name: "Erick Ramos",
    password: ERICK_PASSWORD,
    primaryRoleName: "super_admin",
    primaryUnitScope: null,
    roles: [{ roleName: "super_admin", unitScope: null }],
  });
  console.log("Seeded erick.ramos as super_admin");

  // Demo users — todos com senha ifp-demo-2026
  for (const spec of DEMO_USERS) {
    await seedUser(spec);
  }
  console.log(`Seeded ${DEMO_USERS.length} demo users (senha: ${DEMO_PASSWORD})`);
}

main().finally(() => db.$disconnect());
