import "next-auth";
import "next-auth/jwt";

interface UnidadeRef {
  id: string;
  slug: string;
  tipo: string;
}

declare module "next-auth" {
  interface User {
    id: string;
    accessToken: string;
    perfis: string[];
    unidades: UnidadeRef[];
    mustChangePassword: boolean;
  }

  interface Session {
    accessToken: string;
    perfis: string[];
    unidades: UnidadeRef[];
    mustChangePassword: boolean;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken: string;
    perfis: string[];
    unidades: UnidadeRef[];
    mustChangePassword: boolean;
  }
}
