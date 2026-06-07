// Tipos da migração Amplimed → IFP Connect.
// Spec: docs/superpowers/specs/2026-06-07-migracao-amplimed-design.md

// ── Linhas lidas da origem MariaDB (subconjunto usado) ──────────────────────

export interface PacienteRow {
  codp: number;
  nome: string;
  dtnasc: string | null; // varchar BR; formato confirmado no Profile
  genero: string | null;
  email: string | null;
  celular: string | null;
  telf: string | null;
  cpf: string | null;
  rg: string | null;
  nmae: string | null;
  npai: string | null;
  raca: string | null;
  tiposanguineo: string | null;
  alergias: string | null;
  nTemCpf: string | null; // 'true' | 'false'
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

export interface UsuarioRow {
  codu: number;
  nome: string;
  usuario: string | null;
  conselho: string | null;
  registroprof: string | null;
  registrouf: string | null;
  especialidade: number | null;
  userstatus: string | null;
}

export interface ConsultaRow {
  codcon: number;
  codp: number;
  codu: number;
  dtconsulta: string | null; // 'YYYY-MM-DD'
  queixa: string | null;
  anteceden: string | null;
  descfis: string | null;
  conduta: string | null;
  meds: string | null;
  cid10: string | null;
  peso: number | null;
  altura: number | null;
  pas: number | null;
  pad: number | null;
  freqcar: number | null;
  freqres: number | null;
  tempe: number | null;
}

// ── Saídas dos mappers (padrão `problemas: string[]` do import-alunos) ───────

export interface EnderecoMapeado {
  cep: string;
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
}

export interface CidadaoMapeado {
  codp: number;
  nomeCompleto: string;
  cpf: string | null;
  dataNascimento: Date | null;
  telefonePrincipal: string;
  telefoneSecundario: string | null;
  email: string | null;
  genero: string | null;
  corRaca: string | null;
  nomeMae: string | null;
  nomePai: string | null;
  tipoSanguineo: string | null;
  alergias: string | null;
  endereco: EnderecoMapeado | null;
  problemas: string[];
}

export interface DiagnosticoMapeado {
  codigoCid: string | null;
  descricao: string;
  principal: boolean;
}

export interface NotaMapeada {
  codcon: number;
  texto: string;
  paSistolica: number | null;
  paDiastolica: number | null;
  fcBpm: number | null;
  frIrpm: number | null;
  tempC: number | null;
  pesoKg: number | null;
  alturaCm: number | null;
  diagnosticos: DiagnosticoMapeado[];
}

export interface ProfissionalMapeado {
  codu: number;
  nome: string;
  email: string;
  conselho: string;
  nroConselho: string;
  especialidadeAmplimed: number | null;
  problemas: string[];
}
