import { normalizeCpf, validateCpf } from "../cpf";

export function mapCpf(
  cpf: string | null,
  nTemCpf: string | null,
): { cpf: string | null; problema: string | null } {
  const semCpf = (nTemCpf ?? "").toLowerCase() === "true";
  const digitos = normalizeCpf(cpf ?? "");
  if (!digitos) {
    return semCpf ? { cpf: null, problema: null } : { cpf: null, problema: "cpf ausente" };
  }
  if (!validateCpf(digitos)) return { cpf: null, problema: `cpf inválido: ${digitos}` };
  return { cpf: digitos, problema: null };
}

const GENERO: Record<string, string> = {
  m: "masculino",
  masculino: "masculino",
  homem: "masculino",
  f: "feminino",
  feminino: "feminino",
  mulher: "feminino",
};
export function mapGenero(v: string | null): string | null {
  const k = (v ?? "").trim().toLowerCase();
  return GENERO[k] ?? null;
}

const COR_RACA: Record<string, string> = {
  branca: "branca",
  preta: "preta",
  negra: "preta",
  parda: "parda",
  amarela: "amarela",
  indigena: "indigena",
  indígena: "indigena",
};
export function mapCorRaca(v: string | null): string | null {
  const k = (v ?? "").trim().toLowerCase();
  return COR_RACA[k] ?? null;
}

const TITULOS = new Set(["dr", "dra", "sr", "sra"]);

/** Gera e-mail institucional a partir do nome (sem acento, sem título, primeiro.último). */
export function slugEmail(nome: string): string {
  const semAcento = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const partes = semAcento
    .replace(/[^a-z\s]/g, " ") // tira ".", dígitos e pontuação
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !TITULOS.has(p));
  const slug = partes.length >= 2 ? `${partes[0]}.${partes[partes.length - 1]}` : partes.join("");
  return `${slug}@familiaponcio.org.br`;
}
