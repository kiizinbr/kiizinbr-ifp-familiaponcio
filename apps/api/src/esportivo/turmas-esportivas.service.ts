import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AcaoAuditoria,
  Perfil,
  Prisma,
  StatusElegibilidade,
  StatusMatricula,
  StatusTurma,
  TipoUnidade,
} from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { CriarMatriculaEsportivaDto } from "./dto/criar-matricula-esportiva.dto";
import type { CriarTurmaEsportivaDto } from "./dto/criar-turma-esportiva.dto";
import type { EditarTurmaEsportivaDto } from "./dto/editar-turma-esportiva.dto";
import { ProfissionaisService } from "../medico/profissionais.service";

const turmaEsportivaDetalheInclude = {
  modalidade: true,
  instrutor: { include: { user: { select: { nome: true } } } },
  treinos: { orderBy: { data: "asc" as const } },
  matriculas: {
    include: {
      ficha: { select: { id: true, protocolo: true, nomeCompleto: true } },
      membro: { select: { id: true, nomeCompleto: true, dataNascimento: true } },
      graduacoes: { orderBy: { concedidaEm: "asc" as const } },
    },
  },
} satisfies Prisma.TurmaEsportivaInclude;

@Injectable()
export class TurmasEsportivasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  async listar(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const items = await this.prisma.turmaEsportiva.findMany({
      where: { unidadeId: profissional.unidadeId },
      orderBy: { criadoEm: "desc" },
      include: {
        modalidade: true,
        _count: { select: { matriculas: true } },
      },
    });
    return { items };
  }

  /** Modalidades ativas da unidade (para o formulário de nova turma). */
  async modalidades(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const items = await this.prisma.modalidade.findMany({
      where: { unidadeId: profissional.unidadeId, ativo: true },
      orderBy: { nome: "asc" },
      include: { _count: { select: { turmas: true } } },
    });
    return { items };
  }

  /** KPIs da unidade (dashboard). */
  async resumo(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const unidadeId = profissional.unidadeId;
    const [turmasEmAndamento, atletasAtivos, graduacoesConcedidas, listaEspera] =
      await this.prisma.$transaction([
        this.prisma.turmaEsportiva.count({
          where: { unidadeId, status: StatusTurma.EM_ANDAMENTO },
        }),
        this.prisma.matriculaEsportiva.count({
          where: { unidadeId, status: StatusMatricula.ATIVA },
        }),
        this.prisma.graduacao.count({ where: { unidadeId } }),
        this.prisma.matriculaEsportiva.count({
          where: { unidadeId, status: StatusMatricula.LISTA_ESPERA },
        }),
      ]);
    return { turmasEmAndamento, atletasAtivos, graduacoesConcedidas, listaEspera };
  }

  /**
   * Indicadores da unidade (dashboard): graduações por mês, frequência por
   * modalidade e evasão. Só agregados (sem PII), mas mantém a trilha LGPD.
   */
  async indicadores(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const unidadeId = profissional.unidadeId;

    // Graduações concedidas por mês (últimos 6 meses).
    const graduacoesPorMes = await this.prisma.$queryRaw<{ mes: string; total: number }[]>`
      SELECT to_char(date_trunc('month', g."concedidaEm"), 'YYYY-MM') AS mes, count(*)::int AS total
      FROM graduacoes g
      WHERE g."unidadeId" = ${unidadeId}
        AND g."concedidaEm" >= now() - interval '6 months'
      GROUP BY 1 ORDER BY 1
    `;

    // Frequência por modalidade: quem COMPARECEU (PRESENTE + ATRASADO) sobre o
    // total lançado. ATRASADO é o 4º estado da chamada — chegou tarde, mas treinou,
    // então conta na frequência; `atrasos` fica destacado p/ a vitrine de pontualidade.
    // Só treinos selados (encerradoEm) contam — chamada aberta ainda muda.
    const frequenciaPorModalidade = await this.prisma.$queryRaw<
      { modalidade: string; presencas: number; atrasos: number; faltas: number; total: number }[]
    >`
      SELECT m.nome AS modalidade,
             count(*) FILTER (WHERE p.status IN ('PRESENTE','ATRASADO'))::int AS presencas,
             count(*) FILTER (WHERE p.status = 'ATRASADO')::int AS atrasos,
             count(*) FILTER (WHERE p.status = 'FALTA')::int AS faltas,
             count(*)::int AS total
      FROM presencas_treino p
      JOIN treinos_esportivos t ON t.id = p."treinoId" AND t."encerradoEm" IS NOT NULL
      JOIN turmas_esportivas tu ON tu.id = t."turmaId"
      JOIN modalidades m ON m.id = tu."modalidadeId"
      WHERE t."unidadeId" = ${unidadeId}
      GROUP BY m.nome
      ORDER BY m.nome
    `;

    // Evasão por modalidade: matrículas EVADIDA sobre o total que já treinou
    // (exclui LISTA_ESPERA/CANCELADA — quem nunca entrou na turma não evade).
    const evasaoPorModalidade = await this.prisma.$queryRaw<
      { modalidade: string; evadidas: number; base: number }[]
    >`
      SELECT m.nome AS modalidade,
             count(*) FILTER (WHERE me.status = 'EVADIDA')::int AS evadidas,
             count(*) FILTER (WHERE me.status IN ('ATIVA','EVADIDA','CONCLUIDA','TRANCADA'))::int AS base
      FROM matriculas_esportivas me
      JOIN turmas_esportivas tu ON tu.id = me."turmaId"
      JOIN modalidades m ON m.id = tu."modalidadeId"
      WHERE me."unidadeId" = ${unidadeId}
      GROUP BY m.nome
      ORDER BY m.nome
    `;

    const totalBase = evasaoPorModalidade.reduce((s, e) => s + e.base, 0);
    const totalEvadidas = evasaoPorModalidade.reduce((s, e) => s + e.evadidas, 0);
    const taxaEvasaoGeral = totalBase > 0 ? Math.round((totalEvadidas / totalBase) * 100) : null;

    const totalPresencas = frequenciaPorModalidade.reduce((s, f) => s + f.presencas, 0);
    const totalLancamentos = frequenciaPorModalidade.reduce((s, f) => s + f.total, 0);
    const taxaFrequenciaGeral =
      totalLancamentos > 0 ? Math.round((totalPresencas / totalLancamentos) * 100) : null;

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "TurmaEsportiva",
      metadados: { contexto: "esportivo.indicadores" },
    });

    return {
      graduacoesPorMes,
      frequenciaPorModalidade: frequenciaPorModalidade.map((f) => ({
        modalidade: f.modalidade,
        presencas: f.presencas,
        atrasos: f.atrasos,
        faltas: f.faltas,
        total: f.total,
        pct: f.total > 0 ? Math.round((f.presencas / f.total) * 100) : null,
      })),
      evasaoPorModalidade: evasaoPorModalidade.map((e) => ({
        modalidade: e.modalidade,
        evadidas: e.evadidas,
        base: e.base,
        pct: e.base > 0 ? Math.round((e.evadidas / e.base) * 100) : null,
      })),
      taxaFrequenciaGeral,
      taxaEvasaoGeral,
    };
  }

  /**
   * Painel enriquecido: anel de ocupação geral, turmas em quadra hoje e o
   * próximo exame de faixa por turma. Read-only — sem PII no agregado.
   */
  async painel(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const unidadeId = profissional.unidadeId;

    const turmas = await this.prisma.turmaEsportiva.findMany({
      where: { unidadeId, status: StatusTurma.EM_ANDAMENTO },
      include: {
        modalidade: { select: { nome: true, trilhaGraduacoes: true } },
        _count: { select: { matriculas: { where: { status: StatusMatricula.ATIVA } } } },
      },
      orderBy: { codigo: "asc" },
    });

    const vagasTotais = turmas.reduce((s, t) => s + t.vagasTotais, 0);
    const atletasAtivos = turmas.reduce((s, t) => s + t._count.matriculas, 0);
    const ocupacaoPct = vagasTotais > 0 ? Math.round((atletasAtivos / vagasTotais) * 100) : null;

    // Ocupação por modalidade: soma vagas e atletas ativos das turmas EM_ANDAMENTO
    // agrupando pela modalidade. Mostra "qual esporte está lotando" para a gestão
    // decidir onde abrir turma nova. Read agregado, sem PII.
    const ocupacaoModalidadeMap = new Map<
      string,
      { modalidade: string; turmas: number; atletasAtivos: number; vagasTotais: number }
    >();
    for (const t of turmas) {
      const nome = t.modalidade.nome;
      const atual = ocupacaoModalidadeMap.get(nome) ?? {
        modalidade: nome,
        turmas: 0,
        atletasAtivos: 0,
        vagasTotais: 0,
      };
      atual.turmas += 1;
      atual.atletasAtivos += t._count.matriculas;
      atual.vagasTotais += t.vagasTotais;
      ocupacaoModalidadeMap.set(nome, atual);
    }
    const ocupacaoPorModalidade = [...ocupacaoModalidadeMap.values()]
      .map((m) => ({
        ...m,
        pct: m.vagasTotais > 0 ? Math.round((m.atletasAtivos / m.vagasTotais) * 100) : null,
      }))
      .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || a.modalidade.localeCompare(b.modalidade));

    // Demanda reprimida: total na lista de espera da unidade — sinal de quando
    // abrir turma nova. Conta direto no banco (não só nas turmas em quadra).
    const listaEsperaTotal = await this.prisma.matriculaEsportiva.count({
      where: { unidadeId, status: StatusMatricula.LISTA_ESPERA },
    });

    // Turmas com treino marcado para hoje (00:00–23:59 no fuso do servidor).
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);
    const fimHoje = new Date();
    fimHoje.setHours(23, 59, 59, 999);
    const treinosHoje = await this.prisma.treinoEsportivo.findMany({
      where: { unidadeId, data: { gte: inicioHoje, lte: fimHoje } },
      include: {
        turma: { include: { modalidade: { select: { nome: true } } } },
      },
      orderBy: { data: "asc" },
    });
    const emQuadraHoje = treinosHoje.map((t) => ({
      treinoId: t.id,
      turmaId: t.turmaId,
      codigo: t.turma.codigo,
      modalidade: t.turma.modalidade.nome,
      local: t.turma.local,
      diasHorario: t.turma.diasHorario,
      data: t.data,
      selado: t.encerradoEm != null,
    }));

    // Próximo exame de faixa: por turma ativa, o menor nível da trilha que
    // nenhum atleta da turma ainda alcançou (heurística simples para a vitrine).
    const trilhaPorTurma = await this.prisma.turmaEsportiva.findMany({
      where: { unidadeId, status: StatusTurma.EM_ANDAMENTO },
      select: {
        id: true,
        codigo: true,
        modalidade: { select: { nome: true, trilhaGraduacoes: true } },
        matriculas: {
          where: { status: StatusMatricula.ATIVA },
          select: { graduacoes: { select: { nivel: true } } },
        },
      },
      orderBy: { codigo: "asc" },
    });
    const proximosExames = trilhaPorTurma
      .map((t) => {
        const concedidos = new Set<string>();
        for (const m of t.matriculas) for (const g of m.graduacoes) concedidos.add(g.nivel);
        const proximo = t.modalidade.trilhaGraduacoes.find((n) => !concedidos.has(n));
        const atletas = t.matriculas.length;
        return proximo && atletas > 0
          ? { turmaId: t.id, codigo: t.codigo, modalidade: t.modalidade.nome, proximoNivel: proximo, atletas }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "TurmaEsportiva",
      metadados: { contexto: "esportivo.painel" },
    });

    return {
      ocupacao: { atletasAtivos, vagasTotais, pct: ocupacaoPct },
      ocupacaoPorModalidade,
      listaEsperaTotal,
      emQuadraHoje,
      proximosExames,
    };
  }

  /**
   * Catálogo de turmas com filtros (modalidade/status) e grade de horários.
   * Read-only; só metadados de turma (sem PII de atleta).
   */
  async catalogo(user: AuthenticatedUser, filtros: { modalidadeId?: string; status?: string }) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const unidadeId = profissional.unidadeId;

    const statusValido =
      filtros.status && (Object.values(StatusTurma) as string[]).includes(filtros.status)
        ? (filtros.status as StatusTurma)
        : undefined;

    const where: Prisma.TurmaEsportivaWhereInput = {
      unidadeId,
      ...(filtros.modalidadeId ? { modalidadeId: filtros.modalidadeId } : {}),
      ...(statusValido ? { status: statusValido } : {}),
    };

    const turmas = await this.prisma.turmaEsportiva.findMany({
      where,
      orderBy: [{ status: "asc" }, { diasHorario: "asc" }, { codigo: "asc" }],
      include: {
        modalidade: { select: { id: true, nome: true } },
        _count: { select: { matriculas: { where: { status: StatusMatricula.ATIVA } } } },
      },
    });

    const items = turmas.map((t) => {
      const atletasAtivos = t._count.matriculas;
      return {
        id: t.id,
        codigo: t.codigo,
        diasHorario: t.diasHorario,
        local: t.local,
        faixaEtariaMin: t.faixaEtariaMin,
        faixaEtariaMax: t.faixaEtariaMax,
        vagasTotais: t.vagasTotais,
        status: t.status,
        modalidade: t.modalidade,
        atletasAtivos,
        // Vitrine do catálogo: turma sem vaga aberta (matrícula nova cairia na
        // lista de espera). Derivado dos campos já carregados, sem query extra.
        lotada: t.vagasTotais > 0 && atletasAtivos >= t.vagasTotais,
      };
    });

    // Grade: agrupa por dias/horário (a string já é a "faixa" da grade).
    const gradeMap = new Map<string, typeof items>();
    for (const it of items) {
      const lista = gradeMap.get(it.diasHorario) ?? [];
      lista.push(it);
      gradeMap.set(it.diasHorario, lista);
    }
    const grade = [...gradeMap.entries()]
      .map(([diasHorario, turmasDoSlot]) => ({ diasHorario, turmas: turmasDoSlot }))
      .sort((a, b) => a.diasHorario.localeCompare(b.diasHorario));

    // Resumo do conjunto filtrado: cabeçalho de catálogo (quantas por situação e
    // por modalidade) para a tela não precisar recontar no cliente.
    const porStatus = { INSCRICOES_ABERTAS: 0, EM_ANDAMENTO: 0, ENCERRADA: 0 } as Record<
      StatusTurma,
      number
    >;
    const porModalidadeMap = new Map<string, number>();
    let lotadas = 0;
    for (const it of items) {
      porStatus[it.status] += 1;
      porModalidadeMap.set(it.modalidade.nome, (porModalidadeMap.get(it.modalidade.nome) ?? 0) + 1);
      if (it.lotada) lotadas += 1;
    }
    const porModalidade = [...porModalidadeMap.entries()]
      .map(([modalidade, total]) => ({ modalidade, total }))
      .sort((a, b) => b.total - a.total || a.modalidade.localeCompare(b.modalidade));

    return {
      items,
      grade,
      total: items.length,
      resumo: { porStatus, porModalidade, lotadas },
    };
  }

  /** Fichas APROVADAS no Esportivo (para o formulário de matrícula). */
  async fichasElegiveis(user: AuthenticatedUser, q?: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const termo = q?.trim();
    if (!termo || termo.length < 2) return { items: [] };

    // unaccent: "joao" encontra "João" (regra de ouro continua no JOIN de elegibilidade)
    const linhas = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT f.id FROM fichas_cidadas f
      JOIN elegibilidades e ON e."fichaId" = f.id
        AND e."unidadeId" = ${profissional.unidadeId}
        AND e.status = 'APROVADO'::"StatusElegibilidade"
      WHERE f.ativa = true
        AND unaccent(lower(f."nomeCompleto")) LIKE unaccent(lower(${`%${termo}%`}))
      ORDER BY f."nomeCompleto" ASC
      LIMIT 10
    `;

    // Busca lê dado pessoal — entra na trilha LGPD mesmo quando vazia.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "FichaCidada",
      metadados: { contexto: "esportivo.fichasElegiveis", resultados: linhas.length },
    });

    if (linhas.length === 0) return { items: [] };

    const items = await this.prisma.fichaCidada.findMany({
      where: { id: { in: linhas.map((l) => l.id) } },
      orderBy: { nomeCompleto: "asc" },
      select: {
        id: true,
        protocolo: true,
        nomeCompleto: true,
        membros: { select: { id: true, nomeCompleto: true, parentesco: true } },
      },
    });
    return { items };
  }

  /** Cria uma turma; o profissional logado é o instrutor responsável. */
  async criar(user: AuthenticatedUser, dto: CriarTurmaEsportivaDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);

    const modalidade = await this.prisma.modalidade.findFirst({
      where: { id: dto.modalidadeId, unidadeId: profissional.unidadeId, ativo: true },
    });
    if (!modalidade) throw new NotFoundException("Modalidade não encontrada nesta unidade");

    if (
      dto.faixaEtariaMin != null &&
      dto.faixaEtariaMax != null &&
      dto.faixaEtariaMin > dto.faixaEtariaMax
    ) {
      throw new BadRequestException("Faixa etária mínima maior que a máxima.");
    }

    const codigoExiste = await this.prisma.turmaEsportiva.findUnique({
      where: { codigo: dto.codigo },
      select: { id: true },
    });
    if (codigoExiste) {
      throw new ConflictException(`Já existe uma turma com o código ${dto.codigo}.`);
    }

    const turma = await this.prisma.turmaEsportiva.create({
      data: {
        unidadeId: profissional.unidadeId,
        modalidadeId: modalidade.id,
        codigo: dto.codigo,
        profissionalId: profissional.id,
        diasHorario: dto.diasHorario,
        local: dto.local,
        faixaEtariaMin: dto.faixaEtariaMin,
        faixaEtariaMax: dto.faixaEtariaMax,
        inicioEm: new Date(dto.inicioEm),
        vagasTotais: dto.vagasTotais,
        status: StatusTurma.EM_ANDAMENTO,
      },
      include: { modalidade: true, _count: { select: { matriculas: true } } },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "TurmaEsportiva",
      entidadeId: turma.id,
      metadados: { codigo: turma.codigo, modalidade: modalidade.nome },
    });

    return turma;
  }

  /**
   * Corrige os dados operacionais da turma (horário, local, faixa etária, vagas).
   * Não mexe em identidade (modalidade/código) nem no status (tem fluxo próprio).
   */
  async editar(user: AuthenticatedUser, id: string, dto: EditarTurmaEsportivaDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const turma = await this.prisma.turmaEsportiva.findUnique({
      where: { id },
      select: {
        id: true,
        profissionalId: true,
        status: true,
        faixaEtariaMin: true,
        faixaEtariaMax: true,
        _count: { select: { matriculas: { where: { status: StatusMatricula.ATIVA } } } },
      },
    });
    if (!turma) throw new NotFoundException("Turma não encontrada");
    this.profissionais.assertOwnership(turma.profissionalId, profissional, user);
    if (turma.status === StatusTurma.ENCERRADA) {
      throw new BadRequestException("Turma encerrada não pode ser editada.");
    }

    // Faixa etária final coerente (considera os valores que ficarão após o patch).
    const min = dto.faixaEtariaMin !== undefined ? dto.faixaEtariaMin : turma.faixaEtariaMin;
    const max = dto.faixaEtariaMax !== undefined ? dto.faixaEtariaMax : turma.faixaEtariaMax;
    if (min != null && max != null && min > max) {
      throw new BadRequestException("Faixa etária mínima maior que a máxima.");
    }

    // Não reduzir vagas abaixo dos atletas já ATIVOS (evita overbooking retroativo).
    if (dto.vagasTotais !== undefined && dto.vagasTotais < turma._count.matriculas) {
      throw new BadRequestException(
        `A turma já tem ${turma._count.matriculas} atleta(s) ativo(s) — defina ao menos esse número de vagas.`,
      );
    }

    const atualizada = await this.prisma.turmaEsportiva.update({
      where: { id },
      data: {
        ...(dto.diasHorario !== undefined ? { diasHorario: dto.diasHorario } : {}),
        ...(dto.local !== undefined ? { local: dto.local } : {}),
        ...(dto.faixaEtariaMin !== undefined ? { faixaEtariaMin: dto.faixaEtariaMin } : {}),
        ...(dto.faixaEtariaMax !== undefined ? { faixaEtariaMax: dto.faixaEtariaMax } : {}),
        ...(dto.vagasTotais !== undefined ? { vagasTotais: dto.vagasTotais } : {}),
      },
      include: { modalidade: true, _count: { select: { matriculas: true } } },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "TurmaEsportiva",
      entidadeId: id,
      metadados: { acao: "edicao", campos: Object.keys(dto) },
    });

    return atualizada;
  }

  /** Matricula respeitando a regra de ouro (elegibilidade APROVADA) e as vagas. */
  async matricular(user: AuthenticatedUser, turmaId: string, dto: CriarMatriculaEsportivaDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const turma = await this.prisma.turmaEsportiva.findUnique({
      where: { id: turmaId },
      select: { id: true, unidadeId: true, profissionalId: true, status: true },
    });
    if (!turma) throw new NotFoundException("Turma não encontrada");
    this.profissionais.assertOwnership(turma.profissionalId, profissional, user);
    if (turma.status === StatusTurma.ENCERRADA) {
      throw new BadRequestException("A turma já foi encerrada.");
    }

    // Regra de ouro: só matricula quem o Serviço Social aprovou para o Esportivo.
    const elegivel = await this.prisma.elegibilidadePorUnidade.findFirst({
      where: {
        fichaId: dto.fichaId,
        unidadeId: turma.unidadeId,
        status: StatusElegibilidade.APROVADO,
      },
    });
    if (!elegivel) {
      throw new BadRequestException(
        "Esta família não tem elegibilidade APROVADA no Esportivo — encaminhe ao Serviço Social.",
      );
    }

    // Lock da linha da turma: matrículas concorrentes serializam aqui — mata o
    // overbooking, a posição de espera duplicada e a matrícula dupla do titular
    // (o unique composto não cobre membroId NULL). Mesmo desenho da Capacitação.
    const matricula = await this.prisma.$transaction(async (tx) => {
      const [lockada] = await tx.$queryRaw<{ vagasTotais: number; status: string }[]>`
        SELECT "vagasTotais", status FROM turmas_esportivas WHERE id = ${turmaId} FOR UPDATE
      `;
      if (!lockada) throw new NotFoundException("Turma não encontrada");
      if (lockada.status === StatusTurma.ENCERRADA) {
        throw new BadRequestException("A turma já foi encerrada.");
      }

      // IDOR (P1.1): se vier membroId, ele tem de ser dependente DESTA ficha —
      // senão um atleta de outra família é vinculado a esta matrícula (dado de
      // menor cruzando famílias). Mesmo padrão da Capacitação/Educacional.
      if (dto.membroId) {
        const membro = await tx.membroFamiliar.findFirst({
          where: { id: dto.membroId, fichaId: dto.fichaId },
          select: { id: true },
        });
        if (!membro) {
          throw new NotFoundException("Dependente não encontrado nesta família.");
        }
      }

      const duplicada = await tx.matriculaEsportiva.findFirst({
        where: { turmaId, fichaId: dto.fichaId, membroId: dto.membroId ?? null },
        select: { id: true },
      });
      if (duplicada) {
        throw new ConflictException("Este atleta já está matriculado nesta turma.");
      }

      const ativas = await tx.matriculaEsportiva.count({
        where: { turmaId, status: StatusMatricula.ATIVA },
      });
      const temVaga = ativas < lockada.vagasTotais;
      let posicaoEspera: number | null = null;
      if (!temVaga) {
        const naEspera = await tx.matriculaEsportiva.count({
          where: { turmaId, status: StatusMatricula.LISTA_ESPERA },
        });
        posicaoEspera = naEspera + 1;
      }

      return tx.matriculaEsportiva.create({
        data: {
          unidadeId: turma.unidadeId,
          turmaId,
          fichaId: dto.fichaId,
          membroId: dto.membroId,
          status: temVaga ? StatusMatricula.ATIVA : StatusMatricula.LISTA_ESPERA,
          posicaoEspera,
          criadoPor: user.id,
        },
        include: {
          ficha: { select: { id: true, protocolo: true, nomeCompleto: true } },
          membro: { select: { id: true, nomeCompleto: true } },
        },
      });
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "MatriculaEsportiva",
      entidadeId: matricula.id,
      metadados: { turmaId, status: matricula.status },
    });

    return matricula;
  }

  async detalhe(user: AuthenticatedUser, id: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const turma = await this.prisma.turmaEsportiva.findUnique({
      where: { id },
      include: turmaEsportivaDetalheInclude,
    });
    if (!turma) throw new NotFoundException("Turma não encontrada");
    // Tenant: dados de atletas só para a unidade da turma (SUPER_ADMIN passa).
    if (
      !user.perfis.includes(Perfil.SUPER_ADMIN) &&
      turma.unidadeId !== profissional.unidadeId
    ) {
      throw new ForbiddenException("Esta turma pertence a outra unidade.");
    }

    // Detalhe expõe nomes e graduações dos atletas — leitura entra na trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "TurmaEsportiva",
      entidadeId: id,
      metadados: { contexto: "detalhe", matriculas: turma.matriculas.length },
    });

    return turma;
  }

  /** Encerra a turma: ativas viram CONCLUÍDA, espera nunca atendida vira CANCELADA. */
  async encerrar(user: AuthenticatedUser, id: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const previa = await this.prisma.turmaEsportiva.findUnique({
      where: { id },
      select: { id: true, profissionalId: true, status: true },
    });
    if (!previa) throw new NotFoundException("Turma não encontrada");
    this.profissionais.assertOwnership(previa.profissionalId, profissional, user);
    if (previa.status === StatusTurma.ENCERRADA) {
      throw new ConflictException("Turma já encerrada.");
    }

    // Lock na turma: dois encerramentos simultâneos não processam duas vezes.
    const resultado = await this.prisma.$transaction(async (tx) => {
      const [lockada] = await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM turmas_esportivas WHERE id = ${id} FOR UPDATE
      `;
      if (!lockada) throw new NotFoundException("Turma não encontrada");
      if (lockada.status === StatusTurma.ENCERRADA) {
        throw new ConflictException("Turma já encerrada.");
      }

      // Lista de espera nunca atendida morre no encerramento (não é evasão —
      // o atleta nunca treinou; sem isso o KPI de espera ficava inflado p/ sempre).
      const { count: esperaCanceladas } = await tx.matriculaEsportiva.updateMany({
        where: { turmaId: id, status: StatusMatricula.LISTA_ESPERA },
        data: { status: StatusMatricula.CANCELADA },
      });
      const { count: concluidas } = await tx.matriculaEsportiva.updateMany({
        where: { turmaId: id, status: StatusMatricula.ATIVA },
        data: { status: StatusMatricula.CONCLUIDA },
      });
      await tx.turmaEsportiva.update({
        where: { id },
        data: { status: StatusTurma.ENCERRADA, fimEm: new Date() },
      });

      return { concluidas, esperaCanceladas };
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "TurmaEsportiva",
      entidadeId: id,
      metadados: { acao: "encerramento", ...resultado },
    });

    return resultado;
  }
}
