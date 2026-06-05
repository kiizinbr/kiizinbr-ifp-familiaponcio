import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import type { RoleAssignment, RoleName, UnitScope } from "@/lib/rbac-types";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

async function loadUserRoles(userId: string): Promise<RoleAssignment[]> {
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: { role: true },
  });
  return userRoles.map((ur) => ({
    name: ur.role.name as RoleName,
    unitScope: (ur.unitScope as UnitScope | null) ?? null,
  }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Login inicial: user existe; refresh: lê do DB pra pegar mudanças de role
      const t = token as typeof token & {
        roles?: RoleAssignment[];
        primaryRoleName?: RoleName | null;
        primaryUnitScope?: UnitScope | null;
        mustChangePassword?: boolean;
      };
      if (user?.id || trigger === "update") {
        const userId = user?.id ?? token.sub;
        if (userId) {
          const dbUser = await db.user.findUnique({
            where: { id: userId },
            select: { primaryRoleName: true, primaryUnitScope: true, mustChangePassword: true },
          });
          t.roles = await loadUserRoles(userId);
          t.primaryRoleName = (dbUser?.primaryRoleName as RoleName | null) ?? null;
          t.primaryUnitScope = (dbUser?.primaryUnitScope as UnitScope | null) ?? null;
          t.mustChangePassword = dbUser?.mustChangePassword ?? false;
        }
      }
      t.roles ??= [];
      t.primaryRoleName ??= null;
      t.primaryUnitScope ??= null;
      t.mustChangePassword ??= false;
      return t;
    },
    async session({ session, token }) {
      const t = token as typeof token & {
        roles?: RoleAssignment[];
        primaryRoleName?: RoleName | null;
        primaryUnitScope?: UnitScope | null;
        mustChangePassword?: boolean;
      };
      const roles = t.roles ?? [];
      const primaryRoleName = t.primaryRoleName ?? null;
      const primaryUnitScope = t.primaryUnitScope ?? null;
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub ?? "",
          roles,
          primaryRole: primaryRoleName
            ? { name: primaryRoleName, unitScope: primaryUnitScope }
            : null,
          mustChangePassword: t.mustChangePassword ?? false,
        },
      };
    },
  },
  events: {
    async signIn(message) {
      if (message.user.id) {
        await logEvent({
          userId: message.user.id,
          action: "signin_success",
          meta: { provider: message.account?.provider ?? "credentials" },
        });
      }
    },
    async signOut(message) {
      const userId =
        "token" in message ? (message.token?.sub ?? null) : (message.session?.userId ?? null);
      if (userId) {
        await logEvent({ userId, action: "signout" });
      }
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.hashedPassword) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.hashedPassword);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
