/**
 * Catálogo (whitelist) dos parâmetros simples ajustáveis pelo Super Admin no
 * painel de configuração (A6). Só chaves declaradas aqui podem ser lidas ou
 * gravadas — a tabela `Configuracao` guarda apenas overrides; o default mora
 * aqui na aplicação. Cada parâmetro declara tipo + valor padrão + limites.
 *
 * Por que whitelist: evita persistir chave/valor arbitrário (superfície de
 * abuso) e dá validação forte por tipo no PUT.
 */
export type TipoParametro = "boolean" | "number" | "string";

export interface DefParametro {
  chave: string;
  rotulo: string;
  descricao: string;
  tipo: TipoParametro;
  padrao: boolean | number | string;
  // Limites opcionais para number; para string, tamanho máx.
  min?: number;
  max?: number;
  maxLength?: number;
}

/**
 * Parâmetros conhecidos. São valores operacionais simples — nada de segredo nem
 * credencial (esses ficam em env/Vaultwarden). Mantido pequeno e legível.
 */
export const CATALOGO_PARAMETROS: DefParametro[] = [
  {
    chave: "plataforma.nomeExibicao",
    rotulo: "Nome de exibição da plataforma",
    descricao: "Como o sistema se apresenta no topo das telas e relatórios.",
    tipo: "string",
    padrao: "IFP Connect",
    maxLength: 80,
  },
  {
    chave: "matricula.idadeMinimaConsentimento",
    rotulo: "Idade mínima sem consentimento do responsável",
    descricao:
      "Abaixo desta idade, a matrícula exige consentimento do titular (LGPD do menor).",
    tipo: "number",
    padrao: 18,
    min: 0,
    max: 21,
  },
  {
    chave: "verificacaoPublica.habilitada",
    rotulo: "Verificação pública de documentos habilitada",
    descricao: "Liga/desliga a página pública de conferência de documentos por código.",
    tipo: "boolean",
    padrao: true,
  },
  {
    chave: "agenda.antecedenciaMinimaHoras",
    rotulo: "Antecedência mínima para agendar (horas)",
    descricao: "Quantas horas antes um agendamento pode ser criado pela recepção.",
    tipo: "number",
    padrao: 1,
    min: 0,
    max: 168,
  },
];

const POR_CHAVE = new Map(CATALOGO_PARAMETROS.map((p) => [p.chave, p]));

export function getDefParametro(chave: string): DefParametro | undefined {
  return POR_CHAVE.get(chave);
}

/** Converte o valor persistido (sempre texto) para o tipo declarado. */
export function desserializar(def: DefParametro, valor: string): boolean | number | string {
  if (def.tipo === "boolean") return valor === "true";
  if (def.tipo === "number") return Number(valor);
  return valor;
}

/** Serializa o valor recebido para texto, validando contra o catálogo. */
export function serializarValidando(
  def: DefParametro,
  valor: unknown,
): { ok: true; texto: string; typed: boolean | number | string } | { ok: false; erro: string } {
  if (def.tipo === "boolean") {
    if (typeof valor !== "boolean") return { ok: false, erro: "Esperado um booleano (true/false)." };
    return { ok: true, texto: String(valor), typed: valor };
  }
  if (def.tipo === "number") {
    if (typeof valor !== "number" || Number.isNaN(valor)) {
      return { ok: false, erro: "Esperado um número." };
    }
    if (!Number.isInteger(valor)) return { ok: false, erro: "Esperado um número inteiro." };
    if (def.min !== undefined && valor < def.min) {
      return { ok: false, erro: `Valor mínimo é ${def.min}.` };
    }
    if (def.max !== undefined && valor > def.max) {
      return { ok: false, erro: `Valor máximo é ${def.max}.` };
    }
    return { ok: true, texto: String(valor), typed: valor };
  }
  // string
  if (typeof valor !== "string") return { ok: false, erro: "Esperado um texto." };
  const limpo = valor.trim();
  if (!limpo) return { ok: false, erro: "Texto não pode ser vazio." };
  if (def.maxLength !== undefined && limpo.length > def.maxLength) {
    return { ok: false, erro: `Texto muito longo (máx. ${def.maxLength}).` };
  }
  return { ok: true, texto: limpo, typed: limpo };
}
