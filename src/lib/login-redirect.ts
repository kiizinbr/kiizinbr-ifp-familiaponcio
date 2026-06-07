import { unidadeFromSlug } from "@/lib/unidades";

/**
 * Decide para onde mandar um visitante SEM sessão que bateu numa rota protegida.
 *
 * Regra de ouro: **nunca** mandar pra landing pública `/` (perde o destino e
 * parece que "não fez nada"). Sempre cai numa tela de LOGIN.
 *
 * - `/painel/<unidade>`  → `/<unidade>/login` (a unidade é o 2º segmento; o 1º é "painel")
 * - `/<unidade>[/...]`   → `/<unidade>/login`
 * - resto (`/app/*`, `/admin/*`, desconhecido) → `/login` (canônico)
 */
export function loginParaPathDeslogado(path: string): string {
  const painel = path.match(/^\/painel\/([a-z]+)/);
  if (painel && unidadeFromSlug(painel[1]!)) return `/${painel[1]}/login`;

  const direta = path.match(/^\/([a-z]+)/);
  if (direta && unidadeFromSlug(direta[1]!)) return `/${direta[1]}/login`;

  return "/login";
}
