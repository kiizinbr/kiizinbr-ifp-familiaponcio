import type { DefaultSession } from "next-auth";
import type { RoleAssignment, RoleName, UnitScope } from "./src/lib/rbac-types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: RoleAssignment[];
      primaryRole: RoleAssignment | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles: RoleAssignment[];
    primaryRoleName: RoleName | null;
    primaryUnitScope: UnitScope | null;
  }
}
