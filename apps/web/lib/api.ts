/**
 * Contrato client-side com a API IFP Connect.
 *
 * Aqui ficam: a URL base (exposta ao browser via NEXT_PUBLIC_API_URL), o tipo
 * de erro padronizado e os tipos/labels de domínio que as telas do Serviço
 * Social consomem. Os tipos espelham o que o NestJS devolve — valores Decimal
 * do Prisma chegam como string no JSON, e datas como string ISO.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api/v1";

/** Erro de chamada à API: carrega o status HTTP e o corpo cru para depuração. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ============================================================
// Enums (espelham o schema.prisma)
// ============================================================

export type StatusElegibilidade =
  | "PENDENTE"
  | "APROVADO"
  | "REPROVADO"
  | "SUSPENSO"
  | "DESLIGADO";

export type EstadoCivil =
  | "SOLTEIRO"
  | "CASADO"
  | "UNIAO_ESTAVEL"
  | "DIVORCIADO"
  | "VIUVO";

export type Escolaridade =
  | "SEM_ESCOLARIDADE"
  | "FUND_INCOMPLETO"
  | "FUND_COMPLETO"
  | "MEDIO_INCOMPLETO"
  | "MEDIO_COMPLETO"
  | "SUPERIOR_INCOMPLETO"
  | "SUPERIOR_COMPLETO"
  | "POS_GRADUACAO";

export type Parentesco =
  | "CONJUGE"
  | "FILHO"
  | "FILHA"
  | "ENTEADO"
  | "PAI"
  | "MAE"
  | "IRMAO"
  | "IRMA"
  | "AVO"
  | "AVOH"
  | "NETO"
  | "NETA"
  | "OUTRO";

export type SituacaoMoradia =
  | "PROPRIA"
  | "ALUGADA"
  | "CEDIDA"
  | "FINANCIADA"
  | "OCUPACAO"
  | "OUTRA";

export type TipoUnidade = "MEDICO" | "CAPACITACAO" | "ESPORTIVO" | "EDUCACIONAL";

// ============================================================
// Labels PT-BR para exibição (selects e badges)
// ============================================================

export const STATUS_LABEL: Record<StatusElegibilidade, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
  SUSPENSO: "Suspenso",
  DESLIGADO: "Desligado",
};

export const ESTADO_CIVIL_LABEL: Record<EstadoCivil, string> = {
  SOLTEIRO: "Solteiro(a)",
  CASADO: "Casado(a)",
  UNIAO_ESTAVEL: "União estável",
  DIVORCIADO: "Divorciado(a)",
  VIUVO: "Viúvo(a)",
};

export const ESCOLARIDADE_LABEL: Record<Escolaridade, string> = {
  SEM_ESCOLARIDADE: "Sem escolaridade",
  FUND_INCOMPLETO: "Fundamental incompleto",
  FUND_COMPLETO: "Fundamental completo",
  MEDIO_INCOMPLETO: "Médio incompleto",
  MEDIO_COMPLETO: "Médio completo",
  SUPERIOR_INCOMPLETO: "Superior incompleto",
  SUPERIOR_COMPLETO: "Superior completo",
  POS_GRADUACAO: "Pós-graduação",
};

export const PARENTESCO_LABEL: Record<Parentesco, string> = {
  CONJUGE: "Cônjuge",
  FILHO: "Filho",
  FILHA: "Filha",
  ENTEADO: "Enteado(a)",
  PAI: "Pai",
  MAE: "Mãe",
  IRMAO: "Irmão",
  IRMA: "Irmã",
  AVO: "Avô",
  AVOH: "Avó",
  NETO: "Neto",
  NETA: "Neta",
  OUTRO: "Outro",
};

export const SITUACAO_MORADIA_LABEL: Record<SituacaoMoradia, string> = {
  PROPRIA: "Própria",
  ALUGADA: "Alugada",
  CEDIDA: "Cedida",
  FINANCIADA: "Financiada",
  OCUPACAO: "Ocupação",
  OUTRA: "Outra",
};

/** As 4 unidades do Instituto (slugs batem com o seed e a rota de elegibilidade). */
export const UNIDADES: { slug: string; nome: string; tipo: TipoUnidade }[] = [
  { slug: "medico", nome: "Centro Médico", tipo: "MEDICO" },
  { slug: "capacitacao", nome: "Centro de Capacitação", tipo: "CAPACITACAO" },
  { slug: "esportivo", nome: "Centro Esportivo", tipo: "ESPORTIVO" },
  { slug: "educacional", nome: "Centro Recreativo / Educacional", tipo: "EDUCACIONAL" },
];

/** Helper: transforma um Record de labels em opções {value,label} para <select>. */
export function asOptions<T extends string>(
  labels: Record<T, string>,
): { value: T; label: string }[] {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({
    value,
    label,
  }));
}

// ============================================================
// Tipos de domínio (retornos da API)
// ============================================================

export interface Unidade {
  id: string;
  slug: string;
  tipo: TipoUnidade;
  nome: string;
}

export interface Elegibilidade {
  id: string;
  status: StatusElegibilidade;
  motivo?: string | null;
  reavaliarEm?: string | null;
  avaliadoEm?: string | null;
  unidade: Unidade;
}

export interface Membro {
  id: string;
  nomeCompleto: string;
  cpf?: string | null;
  dataNascimento: string;
  parentesco: Parentesco;
  ocupacao?: string | null;
  escolaridade?: Escolaridade | null;
  rendaMensal?: string | null;
  observacoes?: string | null;
}

export interface DadosSocio {
  rendaFamiliarTotal: string;
  rendaPerCapita: string;
  recebeBolsaFamilia: boolean;
  recebeBPC: boolean;
  recebeAuxilioGas: boolean;
  outrosBeneficios?: string | null;
  situacaoMoradia: SituacaoMoradia;
  numeroPessoasMoradia: number;
  numeroComodos?: number | null;
  temAguaEncanada: boolean;
  temEsgoto: boolean;
  temEnergiaEletrica: boolean;
  vulnerabilidades?: string | null;
}

/** Ficha como vem na listagem (campos essenciais + elegibilidades). */
export interface FichaResumo {
  id: string;
  protocolo: string;
  nomeCompleto: string;
  cpf: string;
  telefone: string;
  dataNascimento: string;
  ativa: boolean;
  criadoEm: string;
  elegibilidades: Elegibilidade[];
}

/** Ficha completa (GET /:id) — inclui titular completo, membros e dados socio. */
export interface FichaDetalhe extends FichaResumo {
  rg?: string | null;
  estadoCivil?: EstadoCivil | null;
  escolaridade?: Escolaridade | null;
  email?: string | null;
  telefoneAlt?: string | null;
  whatsappOptIn: boolean;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade: string;
  uf: string;
  observacoes?: string | null;
  membros: Membro[];
  dadosSocio?: DadosSocio | null;
}

export interface Paginacao {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface ListaFichas {
  items: FichaResumo[];
  pagination: Paginacao;
}

// ============================================================
// Serviço Social — Triagem (fila de entrada das famílias)
// ============================================================

export type StatusTriagem = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA";
export type PrioridadeTriagem = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";

export const STATUS_TRIAGEM_LABEL: Record<StatusTriagem, string> = {
  PENDENTE: "Na fila",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
};

export const PRIORIDADE_TRIAGEM_LABEL: Record<PrioridadeTriagem, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

/** Ficha resumida embutida em cada item da fila (select mínimo do backend). */
export interface TriagemFicha {
  id: string;
  protocolo: string;
  nomeCompleto: string;
  telefone: string;
  dataNascimento: string;
}

export interface TriagemItem {
  id: string;
  fichaId: string;
  status: StatusTriagem;
  prioridade: PrioridadeTriagem;
  motivoSolicitacao: string | null;
  iniciadaEm: string | null;
  concluidaEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
  /** Dias desde a abertura (calculado pelo backend). */
  diasEspera: number;
  ficha: TriagemFicha;
}

/** Ficha enxuta para a LISTA/fila (minimização LGPD: sem telefone/nascimento). */
export interface TriagemFichaLista {
  id: string;
  protocolo: string;
  nomeCompleto: string;
}

/** Item da fila — ficha enxuta. O detalhe/criar usam TriagemItem (ficha completa). */
export interface TriagemListaItem extends Omit<TriagemItem, "ficha"> {
  ficha: TriagemFichaLista;
}

export interface TriagemKpis {
  naFila: number;
  prioritarias: number;
  maiorEsperaDias: number;
}

export interface ListaTriagens {
  items: TriagemListaItem[];
  kpis: TriagemKpis;
  pagination: Paginacao;
}

// ============================================================
// Serviço Social — Encaminhamentos (entre unidades) e Ponte
// (sinalizações dos profissionais ao Serviço Social)
// ============================================================

/** Prioridade binária compartilhada por encaminhamento e sinalização. */
export type PrioridadeSinal = "NORMAL" | "URGENTE";
export type StatusEncaminhamento = "PENDENTE" | "ACEITO" | "RECUSADO";
export type StatusSinalizacao = "PENDENTE" | "ATENDIDA";
export type TipoSinalizacao = "ENCAMINHAMENTO" | "OBSERVACAO" | "ALERTA";

export const PRIORIDADE_SINAL_LABEL: Record<PrioridadeSinal, string> = {
  NORMAL: "Normal",
  URGENTE: "Urgente",
};

export const STATUS_ENCAMINHAMENTO_LABEL: Record<StatusEncaminhamento, string> = {
  PENDENTE: "Pendente",
  ACEITO: "Aceito",
  RECUSADO: "Recusado",
};

export const STATUS_SINALIZACAO_LABEL: Record<StatusSinalizacao, string> = {
  PENDENTE: "Pendente",
  ATENDIDA: "Atendida",
};

export const TIPO_SINALIZACAO_LABEL: Record<TipoSinalizacao, string> = {
  ENCAMINHAMENTO: "Encaminhamento",
  OBSERVACAO: "Observação",
  ALERTA: "Alerta",
};

/** Referências mínimas embutidas nas respostas (LGPD: select enxuto). */
export interface FichaRef {
  id: string;
  protocolo: string;
  nomeCompleto: string;
}
export interface UnidadeRef {
  slug: string;
  nome: string;
}

export interface Encaminhamento {
  id: string;
  fichaId: string;
  status: StatusEncaminhamento;
  prioridade: PrioridadeSinal;
  motivo: string;
  justificativaResposta: string | null;
  respondidoPor: string | null;
  respondidoEm: string | null;
  criadoEm: string;
  ficha: FichaRef;
  unidadeOrigem: UnidadeRef;
  unidadeDestino: UnidadeRef;
}

export interface EncaminhamentoKpis {
  pendentes: number;
  aceitosSemana: number;
  recusadosMes: number;
  tempoMedioDias: number;
}

export interface ListaEncaminhamentos {
  items: Encaminhamento[];
  kpis: EncaminhamentoKpis;
  pagination: Paginacao;
}

export interface SinalizacaoPonte {
  id: string;
  fichaId: string;
  membroId: string | null;
  tipo: TipoSinalizacao;
  prioridade: PrioridadeSinal;
  descricao: string;
  status: StatusSinalizacao;
  respondidoPor: string | null;
  respondidoEm: string | null;
  criadoEm: string;
  ficha: FichaRef;
  membro: { id: string; nomeCompleto: string } | null;
  unidadeOrigem: UnidadeRef;
}

export interface SinalizacaoKpis {
  pendentes: number;
  urgentes: number;
}

export interface ListaSinalizacoes {
  items: SinalizacaoPonte[];
  kpis: SinalizacaoKpis;
  pagination: Paginacao;
}

// ============================================================
// Centro Médico (Fase 1 — agenda + prancha de atendimento)
// ============================================================

export type StatusAgendamento =
  | "AGENDADO"
  | "CONFIRMADO"
  | "EM_ATENDIMENTO"
  | "CONCLUIDO"
  | "FALTOU"
  | "CANCELADO";

export const STATUS_AGENDAMENTO_LABEL: Record<StatusAgendamento, string> = {
  AGENDADO: "Agendado",
  CONFIRMADO: "Confirmado",
  EM_ATENDIMENTO: "Em atendimento",
  CONCLUIDO: "Concluído",
  FALTOU: "Faltou",
  CANCELADO: "Cancelado",
};

export type GravidadeAlergia = "LEVE" | "MODERADA" | "GRAVE";

export interface Alergia {
  id: string;
  descricao: string;
  gravidade?: GravidadeAlergia | null;
  ativa: boolean;
}

export interface CondicaoCronica {
  id: string;
  descricao: string;
  cid10?: string | null;
  ativa: boolean;
}

/** Decimais do Prisma chegam como string no JSON (temperatura, peso, altura). */
export interface SinaisVitais {
  pressaoSistolica?: number | null;
  pressaoDiastolica?: number | null;
  frequenciaCardiaca?: number | null;
  frequenciaRespiratoria?: number | null;
  temperaturaC?: string | null;
  saturacaoO2?: number | null;
  pesoKg?: string | null;
  alturaCm?: string | null;
  glicemia?: number | null;
  queixaPrincipal?: string | null;
}

export interface Atendimento {
  id: string;
  subjetivo?: string | null;
  objetivo?: string | null;
  avaliacao?: string | null;
  plano?: string | null;
  cid10?: string | null;
  iniciadoEm: string;
  encerradoEm?: string | null;
  vitais?: SinaisVitais | null;
}

/** Item da agenda do dia (GET /medico/agenda). */
export interface AgendamentoResumo {
  id: string;
  inicioEm: string;
  fimEm: string;
  status: StatusAgendamento;
  motivo?: string | null;
  ficha: Pick<FichaResumo, "id" | "protocolo" | "nomeCompleto" | "cpf" | "dataNascimento">;
  membro?: Membro | null;
  atendimento?: { id: string; encerradoEm?: string | null } | null;
}

export interface AgendaDia {
  items: AgendamentoResumo[];
  dia: string;
}

/** Ficha como vem no payload da prancha (com histórico clínico). */
export interface FichaPrancha {
  id: string;
  protocolo: string;
  nomeCompleto: string;
  cpf: string;
  dataNascimento: string;
  alergias: Alergia[];
  condicoesCronicas: CondicaoCronica[];
  elegibilidades: Elegibilidade[];
}

/** Payload completo da prancha (GET /medico/agenda/:agendamentoId). */
export interface Prancha {
  id: string;
  inicioEm: string;
  fimEm: string;
  status: StatusAgendamento;
  motivo?: string | null;
  ficha: FichaPrancha;
  membro?: Membro | null;
  atendimento?: Atendimento | null;
}

// ============================================================
// Capacitação (Fase 3 — turmas, chamada e certificado verificável)
// ============================================================

export type StatusTurma = "INSCRICOES_ABERTAS" | "EM_ANDAMENTO" | "ENCERRADA";
export type StatusMatricula = "ATIVA" | "LISTA_ESPERA" | "TRANCADA" | "EVADIDA" | "CONCLUIDA";
export type StatusPresenca = "PRESENTE" | "FALTA" | "JUSTIFICADA";

export const STATUS_TURMA_LABEL: Record<StatusTurma, string> = {
  INSCRICOES_ABERTAS: "Inscrições abertas",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
};

export const STATUS_MATRICULA_LABEL: Record<StatusMatricula, string> = {
  ATIVA: "Ativa",
  LISTA_ESPERA: "Lista de espera",
  TRANCADA: "Trancada",
  EVADIDA: "Evadida",
  CONCLUIDA: "Concluída",
};

export const STATUS_PRESENCA_LABEL: Record<StatusPresenca, string> = {
  PRESENTE: "Presente",
  FALTA: "Falta",
  JUSTIFICADA: "Justificada",
};

export interface Curso {
  id: string;
  nome: string;
  cargaHorariaTotal: number;
  presencaMinimaPct: number;
}

export interface AulaInfo {
  id: string;
  data: string;
  conteudo?: string | null;
  encerradaEm?: string | null;
}

export interface CertificadoInfo {
  id: string;
  codigoVerificacao: string;
  cargaHorariaCumprida: number;
  presencaPct: string; // Decimal vem como string
  emitidoEm: string;
}

export interface TurmaResumo {
  id: string;
  codigo: string;
  diasHorario: string;
  sala?: string | null;
  inicioEm: string;
  status: StatusTurma;
  vagasTotais: number;
  curso: Curso;
  _count: { matriculas: number; aulas: number };
}

export interface MatriculaTurma {
  id: string;
  status: StatusMatricula;
  presencaPct: number;
  ficha: { id: string; protocolo: string; nomeCompleto: string };
  membro?: { id: string; nomeCompleto: string } | null;
  certificado?: CertificadoInfo | null;
}

export interface TurmaDetalhe {
  id: string;
  codigo: string;
  diasHorario: string;
  sala?: string | null;
  inicioEm: string;
  status: StatusTurma;
  vagasTotais: number;
  curso: Curso;
  instrutor: { user: { nome: string } };
  aulas: AulaInfo[];
  aulasEncerradas: number;
  matriculas: MatriculaTurma[];
}

export interface ResumoEncerramentoTurma {
  certificadosEmitidos: number;
  evadidas: number;
  codigos: string[];
}

/** Item da busca enxuta de pacientes/famílias (agendar, matricular). */
export interface FichaBuscaItem {
  id: string;
  protocolo: string;
  nomeCompleto: string;
  dataNascimento?: string;
  membros: { id: string; nomeCompleto: string; parentesco: Parentesco }[];
}

/** KPIs da Capacitação (dashboard). */
export interface ResumoCapacitacao {
  turmasEmAndamento: number;
  alunosAtivos: number;
  certificadosEmitidos: number;
  listaEspera: number;
}

/** Resposta pública da verificação de certificado (QR). */
export interface VerificacaoCertificado {
  valido: boolean;
  aluno?: string;
  curso?: string;
  turma?: string;
  cargaHorariaCumprida?: number;
  presencaPct?: number;
  emitidoEm?: string;
}

/** Item de ementa (tópico) dentro de um módulo do curso. */
export interface EmentaItem {
  id: string;
  ordem: number;
  descricao: string;
}

/** Módulo da trilha do curso, com seus itens de ementa. */
export interface ModuloCurso {
  id: string;
  ordem: number;
  nome: string;
  cargaHoraria?: number | null;
  itens: EmentaItem[];
}

/** Detalhe do curso com a trilha (módulos + ementa) e nº de turmas. */
export interface CursoDetalhe {
  id: string;
  nome: string;
  modalidade: "PRATICO" | "TEORICO";
  cargaHorariaTotal: number;
  presencaMinimaPct: number;
  requerModelos: boolean;
  ativo: boolean;
  _count: { turmas: number };
  modulos: ModuloCurso[];
  /** Soma da carga horária informada nos módulos. */
  cargaModulos: number;
}

/** Aluno dentro de uma turma na visão consolidada de matrículas. */
export interface MatriculaConsolidadaAluno {
  id: string;
  aluno: string;
  protocolo: string;
  status: StatusMatricula;
  posicaoEspera: number | null;
  certificado: string | null;
}

/** Bloco turma → alunos na visão consolidada do semestre. */
export interface MatriculasTurmaConsolidada {
  turmaId: string;
  codigo: string;
  statusTurma: StatusTurma;
  curso: string;
  alunos: MatriculaConsolidadaAluno[];
}

/** Matrículas consolidadas da unidade (visão de semestre). */
export interface MatriculasSemestre {
  total: number;
  totaisPorStatus: Record<string, number>;
  turmas: MatriculasTurmaConsolidada[];
}
