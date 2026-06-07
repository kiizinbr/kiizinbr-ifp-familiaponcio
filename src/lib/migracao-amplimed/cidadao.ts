import type { PacienteRow, CidadaoMapeado, EnderecoMapeado } from "./tipos";
import { parseDataNascimento } from "./datas";
import { mapCpf, mapGenero, mapCorRaca } from "./pessoa";

/// Decisão 2026-06-07: migrar TODOS os pacientes. Nome ausente vira placeholder
/// (sinalizado em `problemas` p/ correção futura); telefone/data ausentes viram
/// null e NÃO bloqueiam (campos relaxados no schema). `problemas` é relatório de
/// qualidade — o load NÃO descarta cidadão por causa dele.
const NOME_PLACEHOLDER = "(nome não informado)";

function mapEndereco(row: PacienteRow): EnderecoMapeado | null {
  if (!row.endereco?.trim() || !row.cidade?.trim() || !row.uf?.trim()) return null;
  const cep = (row.cep ?? "").replace(/\D/g, "");
  return {
    cep: cep.length === 8 ? cep : "",
    logradouro: row.endereco.trim(),
    numero: row.numero?.trim() || null,
    bairro: row.bairro?.trim() || null,
    cidade: row.cidade.trim(),
    uf: row.uf.trim().toUpperCase().slice(0, 2),
  };
}

export function mapPacienteParaCidadao(row: PacienteRow): CidadaoMapeado {
  const problemas: string[] = [];
  const { cpf, problema: pCpf } = mapCpf(row.cpf, row.nTemCpf);
  if (pCpf) problemas.push(pCpf);
  const { data, problema: pData } = parseDataNascimento(row.dtnasc);
  if (pData) problemas.push(pData);

  // telefone histórico ausente é comum → null, não bloqueia.
  const telefonePrincipal = (row.celular || row.telf || "").trim() || null;
  // nome ausente → placeholder, mas sinalizado p/ revisão (30 registros).
  const nome = row.nome?.trim() || "";
  if (!nome) problemas.push("nome ausente (placeholder aplicado)");

  return {
    codp: row.codp,
    nomeCompleto: nome || NOME_PLACEHOLDER,
    cpf,
    dataNascimento: data,
    telefonePrincipal,
    telefoneSecundario: row.telf && row.telf.trim() !== telefonePrincipal ? row.telf.trim() : null,
    email: row.email?.trim() || null,
    genero: mapGenero(row.genero),
    corRaca: mapCorRaca(row.raca),
    nomeMae: row.nmae?.trim() || null,
    nomePai: row.npai?.trim() || null,
    tipoSanguineo: row.tiposanguineo?.trim() || null,
    alergias: row.alergias?.trim() || null,
    endereco: mapEndereco(row),
    problemas,
  };
}
