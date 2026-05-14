import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const API_URL = process.env.API_URL ?? "http://localhost:3333/api/v1";

interface ApiLoginResponse {
  accessToken: string;
  user: {
    id: string;
    nome: string;
    email: string;
    perfis: string[];
    unidades: { id: string; slug: string; tipo: string }[];
  };
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "IFP Connect",
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.senha) return null;

        const res = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: credentials.email, senha: credentials.senha }),
          cache: "no-store",
        });

        if (!res.ok) return null;
        const data = (await res.json()) as ApiLoginResponse;

        return {
          id: data.user.id,
          name: data.user.nome,
          email: data.user.email,
          accessToken: data.accessToken,
          perfis: data.user.perfis,
          unidades: data.user.unidades,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.perfis = user.perfis;
        token.unidades = user.unidades;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.perfis = token.perfis;
      session.unidades = token.unidades;
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};
