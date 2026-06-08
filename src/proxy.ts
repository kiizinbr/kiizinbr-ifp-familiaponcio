import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { canAccessUnidade, hasAnyRole } from "@/lib/rbac";
import { UNIDADE_SLUGS } from "@/lib/unidades";
import { loginParaPathDeslogado } from "@/lib/login-redirect";

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

  // Sessão obrigatória para qualquer outro path coberto pelo matcher.
  // Manda SEMPRE pra uma tela de LOGIN (nunca pra landing pública `/`), preservando
  // a unidade quando o path tem uma. Fecha o "deep-link/painel vai pra homepage".
  // Lógica testada em lib/login-redirect (login-redirect.test.ts).
  if (!session) {
    return Response.redirect(new URL(loginParaPathDeslogado(path), origin));
  }

  // Troca de senha obrigatória (1º acesso / senha provisória): tranca o app inteiro
  // até a pessoa definir uma senha própria. /conta/senha fica fora do matcher → sem loop.
  if (session.user.mustChangePassword) {
    return Response.redirect(new URL("/conta/senha", origin));
  }

  // /admin/audit → só super_admin (existente)
  if (path.startsWith("/admin/audit")) {
    if (!hasAnyRole(session, "super_admin")) {
      return Response.redirect(new URL("/acesso-negado", origin));
    }
    return;
  }

  // /admin/* (users etc) → super_admin (gestor_geral foi removida na T3-T4)
  if (path.startsWith("/admin")) {
    if (!hasAnyRole(session, "super_admin", "presidencia")) {
      return Response.redirect(new URL("/acesso-negado", origin));
    }
    return;
  }

  // Roteamento antigo aposentado: /app (raiz) -> /inicio (redirect na própria page)
  // e /app/<unidade> removido na Camada 2 (a tela mock de unidade foi apagada; os
  // ladrilhos de /inicio apontam direto pra /<unidade>). /app/social ainda encaminha;
  // /app/cidadaos e /app/vagas seguem ativas (passthrough abaixo).
  if (path === "/app/social" || path.startsWith("/app/social/")) {
    return Response.redirect(new URL("/social", origin));
  }

  // Demais sub-rotas /app/cidadaos, /app/vagas — escopo unitário existente
  // (mantém o escopo de unit-scope nas pages até a spec de verticalização migrar)
  if (path.startsWith("/app/")) {
    return;
  }

  // Painel da TV: /painel/[unidade] — exige acesso a unidade (quiosque passa).
  const painelMatch = path.match(/^\/painel\/([a-z]+)/);
  if (painelMatch) {
    const slug = painelMatch[1]!;
    if (!canAccessUnidade(session, slug)) {
      return Response.redirect(new URL("/acesso-negado", origin));
    }
    return;
  }

  // /[unidade] → canAccessUnidade
  for (const slug of UNIDADE_SLUGS) {
    if (path === `/${slug}` || path.startsWith(`/${slug}/`)) {
      // /<slug>/login já tratado acima como público
      if (!canAccessUnidade(session, slug)) {
        return Response.redirect(new URL("/acesso-negado", origin));
      }
      return;
    }
  }
});

export const config = {
  matcher: [
    "/",
    "/inicio",
    "/acesso-negado",
    "/app/:path*",
    "/admin/:path*",
    "/medico/:path*",
    "/capacitacao/:path*",
    "/esportivo/:path*",
    "/recreativo/:path*",
    "/poncio/:path*",
    "/social/:path*",
    "/reset/:path*",
    "/painel/:path*",
  ],
};
