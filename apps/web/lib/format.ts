/**
 * Formatação para exibição (PT-BR). Funções puras, sem dependência de React.
 *
 * Datas "date-only" (nascimento) são formatadas a partir da string ISO sem
 * criar um Date — assim evitamos o deslocamento de fuso que faria 30/05 virar
 * 29/05 em quem está em horário de Brasília.
 */

/** "12345678901" -> "123.456.789-01" (deixa como veio se não tiver 11 dígitos). */
export function formatCpf(cpf?: string | null): string {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** "21999998888" -> "(21) 99999-8888"; aceita fixo de 10 dígitos. */
export function formatTelefone(tel?: string | null): string {
  if (!tel) return "—";
  const d = tel.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

/** "2000-05-30T00:00:00.000Z" -> "30/05/2000" (sem fuso). */
export function formatDataISO(iso?: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

/** Timestamp com data e hora local (criadoEm, avaliadoEm). */
export function formatDataHora(iso?: string | null): string {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}

/** Idade em anos completos a partir da data de nascimento (ISO). */
export function idadeAnos(isoNascimento?: string | null): number | null {
  if (!isoNascimento) return null;
  const [ano, mes, dia] = isoNascimento.slice(0, 10).split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  const mesAtual = hoje.getMonth() + 1;
  if (mesAtual < mes || (mesAtual === mes && hoje.getDate() < dia)) idade -= 1;
  return idade;
}

/** "1234.5" | 1234.5 -> "R$ 1.234,50". */
export function formatMoeda(valor?: string | number | null): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const num = typeof valor === "string" ? Number(valor) : valor;
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}
