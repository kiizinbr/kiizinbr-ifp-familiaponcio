import { UNIDADE_SLUGS, type UnidadeSlug } from "@/lib/unidades";

/**
 * Temas CASA — tematização por unidade via atributo `data-theme="<slug>"`
 * num container (4º contrato de atributo; ver src/styles/casa-tokens.css).
 *
 * ESTRATÉGIA A da reconciliação: os temas SÃO os slugs canônicos das
 * unidades da main (não os nomes do protótipo CASA — educacional/
 * servico-social/presidencia viram recreativo/social/poncio aqui).
 */
export const TEMAS_CASA = UNIDADE_SLUGS;

export type TemaCasa = UnidadeSlug;

/** Type guard: o valor é um tema CASA válido? */
export function ehTemaCasa(valor: string | null | undefined): valor is TemaCasa {
  return typeof valor === "string" && (UNIDADE_SLUGS as readonly string[]).includes(valor);
}

/**
 * Resolve um slug arbitrário (querystring, param de rota) pro tema CASA.
 * Inválido/ausente → null (container fica sem atributo → trio default "Corte").
 */
export function temaCasaDoSlug(slug: string | null | undefined): TemaCasa | null {
  return ehTemaCasa(slug) ? slug : null;
}
