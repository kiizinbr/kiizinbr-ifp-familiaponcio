import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { canAccessUnit, hasAnyRole } from "@/lib/rbac";
import type { UnitScope } from "@/lib/rbac-types";

export default auth((req) => {
  const session = req.auth as Session | null;
  const path = req.nextUrl.pathname;
  const origin = req.nextUrl.origin;

  // Sem sessão → /login pra qualquer rota protegida
  if (!session) {
    if (path.startsWith("/app") || path.startsWith("/admin")) {
      return Response.redirect(new URL("/login", origin));
    }
    return;
  }

  // /admin/audit → só super_admin
  if (path.startsWith("/admin/audit")) {
    if (!hasAnyRole(session, "super_admin")) {
      return Response.redirect(new URL("/", origin));
    }
    return;
  }

  // /admin/* (users etc) → super_admin (T4: gestor_geral foi removido)
  if (path.startsWith("/admin")) {
    if (!hasAnyRole(session, "super_admin")) {
      return Response.redirect(new URL("/", origin));
    }
    return;
  }

  // /app/social → social, super_admin (T4: gestor_geral foi removido)
  if (path.startsWith("/app/social")) {
    if (!hasAnyRole(session, "social", "super_admin")) {
      return Response.redirect(new URL("/", origin));
    }
    return;
  }

  // /app (raiz) → só global roles (Plano 2 §0.9 + T4: sem gestor_geral)
  if (path === "/app" || path === "/app/") {
    if (!hasAnyRole(session, "super_admin", "presidencia")) {
      return Response.redirect(new URL("/", origin));
    }
    return;
  }

  // /app/<unidade> → quem tem acesso à unidade (gestor_unidade/profissional/recepcao
  // da unidade OU super_admin/presidencia que têm acesso global)
  // NOTA: T10 vai reescrever este proxy.ts com path-based routing baseado em UNIDADES.
  const unitMatch = path.match(/^\/app\/(medico|capacitacao|esportivo|recreativo)(?:\/|$)/);
  if (unitMatch) {
    const unit = unitMatch[1] as UnitScope;
    if (!canAccessUnit(session, unit)) {
      return Response.redirect(new URL("/", origin));
    }
  }
});

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
