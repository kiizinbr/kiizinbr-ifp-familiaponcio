/**
 * Importador de alunas da Capacitação (planilha legada → pré-cadastro). PURO: só
 * parseia e normaliza strings — NÃO toca o banco. A carga real (com gravação) só
 * acontece na Fase 1, em produção, depois da base legal LGPD. Por ora: dry-run.
 *
 * O CSV legado é mal-formado: as colunas são fixas
 *   nome | email | telefone | endereço | curso | bairro | turno | status
 * mas o ENDEREÇO contém vírgulas sem aspas consistentes. Como só o endereço varia
 * em vírgulas, ancoramos pelas pontas: as 3 primeiras + as 4 últimas colunas são
 * fixas; o endereço é o miolo (slice(3, n-4)).
 */

export interface AlunoCsvRow {
  nome: string;
  email: string;
  telefone: string;
  endereco: string;
  curso: string;
  bairro: string;
  turno: string;
  status: string;
}

function limpaCampo(s: string): string {
  return s
    .trim()
    .replace(/^"+|"+$/g, "")
    .trim();
}

/** Parseia uma linha; null se < 8 campos ou nome vazio. Recupera vírgula no endereço. */
export function parseLinhaAluno(linha: string): AlunoCsvRow | null {
  const campos = linha.split(",");
  if (campos.length < 8) return null;
  const n = campos.length;
  const nome = limpaCampo(campos[0] ?? "");
  if (!nome) return null;
  return {
    nome,
    email: limpaCampo(campos[1] ?? ""),
    telefone: limpaCampo(campos[2] ?? ""),
    endereco: limpaCampo(campos.slice(3, n - 4).join(",")),
    curso: limpaCampo(campos[n - 4] ?? ""),
    bairro: limpaCampo(campos[n - 3] ?? ""),
    turno: limpaCampo(campos[n - 2] ?? ""),
    status: limpaCampo(campos[n - 1] ?? ""),
  };
}

/** Trim + colapsa espaços internos. */
export function normalizeNome(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Só dígitos; prefixa DDD 21 quando vier sem DDD (8-9 dígitos). null se inválido. */
export function normalizeTelefone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return d;
  if (d.length === 8 || d.length === 9) return `21${d}`;
  return null;
}

export type StatusMatriculaImport = "cursando" | "concluido" | "desistente";

export function mapStatusMatricula(raw: string): StatusMatriculaImport | null {
  const s = raw.trim().toLowerCase();
  if (s.startsWith("cursando")) return "cursando";
  if (s.startsWith("conclu") || s.startsWith("form")) return "concluido"; // "Formado"/"Formada" = concluiu
  if (s.startsWith("desist")) return "desistente";
  return null;
}

export interface AlunoNormalizado {
  nome: string;
  telefone: string | null;
  endereco: string;
  curso: string;
  bairro: string;
  turno: string;
  status: StatusMatriculaImport | null;
  problemas: string[];
}

/** Normaliza uma linha e coleta os problemas que exigem revisão humana. */
export function normalizarAluno(row: AlunoCsvRow): AlunoNormalizado {
  const problemas: string[] = [];
  const telefone = normalizeTelefone(row.telefone);
  if (!telefone) problemas.push("telefone inválido ou ausente");
  // B9 — o normalizeTelefone prefixa DDD 21 (RJ) quando vem sem DDD (8-9 dígitos).
  // Em vez de assumir em silêncio, sinaliza pra revisão humana (o importador é dry-run).
  const digitos = row.telefone.replace(/\D/g, "");
  if (telefone && (digitos.length === 8 || digitos.length === 9)) {
    problemas.push("DDD inferido (21) — confira a origem");
  }
  const status = mapStatusMatricula(row.status);
  if (!status) problemas.push(`status não reconhecido: "${row.status}"`);
  if (!row.curso) problemas.push("curso ausente");
  return {
    nome: normalizeNome(row.nome),
    telefone,
    endereco: row.endereco,
    curso: row.curso,
    bairro: row.bairro,
    turno: row.turno,
    status,
    problemas,
  };
}
