import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SECRET = process.env.NEXTAUTH_SECRET;

/**
 * Enquanto o usuário estiver com senha provisória (`mustChangePassword`), ele é
 * empurrado para /trocar-senha em qualquer rota interna — só sai de lá depois de
 * definir a senha definitiva. Sem token (anônimo) ou sem o flag, o middleware
 * não interfere: cada layout de módulo cuida do seu próprio gating de login.
 */
export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });
  if (token?.mustChangePassword && req.nextUrl.pathname !== "/trocar-senha") {
    const url = req.nextUrl.clone();
    url.pathname = "/trocar-senha";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Apenas áreas internas. Exclui /api, assets e as rotas públicas de acesso.
  matcher: [
    "/",
    "/medico/:path*",
    "/capacitacao/:path*",
    "/educacional/:path*",
    "/esportivo/:path*",
    "/servico-social/:path*",
    "/presidencia/:path*",
    "/familia/:path*",
    "/admin/:path*",
  ],
};
