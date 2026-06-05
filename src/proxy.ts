import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { canAccessUnidade, hasAnyRole } from "@/lib/rbac";
import { UNIDADE_SLUGS, unidadeFromSlug } from "@/lib/unidades";

const PATHS_PUBLICOS = ["/", "/reset"];

export default auth((req) => {
  const session = req.auth as Session | null;
  const path = req.nextUrl.pathname;
  const origin = req.nextUrl.origin;

  // Públicos (landing + reset + páginas de login por unidade)
  if (
    PATHS_PUBLICOS.includes(path) ||
    path.startsWith("/reset/") ||
    UNIDADE_SLUGS.some((s) => path === `/${s}/login`)
  ) {
    return;
  }

  // Sessão obrigatória para qualquer outro path coberto pelo matcher
  if (!session) {
    const slugMatch = path.match(/^\/([a-z]+)/);
    const slug = slugMatch?.[1];
    if (slug && unidadeFromSlug(slug)) {
      return Response.redirect(new URL(`/${slug}/login`, origin));
    }
    return Response.redirect(new URL("/", origin));
  }

  // Troca de senha obrigatória (1º acesso / senha provisória): tranca o app inteiro
  // até a pessoa definir uma senha própria. /conta/senha fica fora do matcher → sem loop.
  if (session.user.mustChangePassword) {
    return Response.redirect(new URL("/conta/senha", origin));
  }

  // /admin/audit → só super_admin (existente)
  if (path.startsWith("/admin/audit")) {
    if (!hasAnyRole(session, "super_admin")) {
      return Response.redirect(new URL("/", origin));
    }
    return;
  }

  // /admin/* (users etc) → super_admin (gestor_geral foi removida na T3-T4)
  if (path.startsWith("/admin")) {
    if (!hasAnyRole(session, "super_admin", "presidencia")) {
      return Response.redirect(new URL("/", origin));
    }
    return;
  }

  // Aliases temporários do roteamento antigo (sub-rotas internas seguem ativas)
  if (path === "/app" || path === "/app/") {
    return Response.redirect(new URL("/poncio", origin));
  }
  if (path === "/app/social" || path.startsWith("/app/social/")) {
    return Response.redirect(new URL("/social", origin));
  }
  const oldUnitMatch = path.match(/^\/app\/(medico|capacitacao|esportivo|recreativo)$/);
  if (oldUnitMatch) {
    return Response.redirect(new URL(`/${oldUnitMatch[1]}`, origin));
  }

  // Demais sub-rotas /app/cidadaos, /app/vagas — escopo unitário existente
  // (mantém o escopo de unit-scope nas pages até a spec de verticalização migrar)
  if (path.startsWith("/app/")) {
    return;
  }

  // /[unidade] → canAccessUnidade
  for (const slug of UNIDADE_SLUGS) {
    if (path === `/${slug}` || path.startsWith(`/${slug}/`)) {
      // /<slug>/login já tratado acima como público
      if (!canAccessUnidade(session, slug)) {
        return Response.redirect(new URL("/", origin));
      }
      return;
    }
  }
});

export const config = {
  matcher: [
    "/",
    "/app/:path*",
    "/admin/:path*",
    "/medico/:path*",
    "/capacitacao/:path*",
    "/esportivo/:path*",
    "/recreativo/:path*",
    "/poncio/:path*",
    "/social/:path*",
    "/reset/:path*",
  ],
};
