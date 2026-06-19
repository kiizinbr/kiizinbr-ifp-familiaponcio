import { SetMetadata } from "@nestjs/common";

export const PERMITE_SENHA_PROVISORIA_KEY = "permite-senha-provisoria";

/**
 * Libera uma rota mesmo quando o usuário ainda está com senha provisória
 * (mustChangePassword=true). Usar nas rotas necessárias para concluir a troca
 * — ex.: POST /auth/trocar-senha e GET /auth/me. Sem este decorator, o
 * JwtAuthGuard bloqueia a rota com 403 enquanto a senha não for trocada.
 */
export const PermiteSenhaProvisoria = () =>
  SetMetadata(PERMITE_SENHA_PROVISORIA_KEY, true);
