import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AcaoAuditoria,
  Perfil,
  Prisma,
  StatusAgendamento,
  StatusElegibilidade,
  TipoUnidade,
} from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { CriarAgendamentoDto } from "./dto/criar-agendamento.dto";
import { ProfissionaisService } from "./profissionais.service";

/**
 * Fuso oficial do negócio. Em Docker o processo roda em UTC — sem isso o "dia"
 * da agenda viraria às 21h de Brasília. Offset fixo: o Brasil não tem horário
 * de verão desde 2019.
 */
const TZ_NEGOCIO = "America/Sao_Paulo";
const OFFSET_SP = "-03:00";

// Minimização (LGPD): a lista da agenda mostra nome + idade — CPF, renda e
// observações da família não saem por aqui.
const agendaInclude = {
  ficha: {
    select: {
      id: true,
      protocolo: true,
      nomeCompleto: true,
      dataNascimento: true,
    },
  },
  membro: {
    select: { id: true, nomeCompleto: true, dataNascimento: true, parentesco: true },
  },
  atendimento: { select: { id: true, encerradoEm: true } },
} satisfies Prisma.AgendamentoInclude;

/**
 * Prancha: o clínico precisa de identificação + histórico clínico (alergias,
 * condições) — RG, contatos, endereço e renda ficam de fora. As elegibilidades
 * são filtradas para a unidade médica do profissional (minimização): o clínico
 * só precisa saber que a família está APROVADA no MÉDICO, não o mapa dela no
 * instituto inteiro.
 */
const pranchaInclude = (unidadeId: string) =>
  ({
    ficha: {
      select: {
        id: true,
        protocolo: true,
        nomeCompleto: true,
        dataNascimento: true,
        alergias: { where: { ativa: true } },
        condicoesCronicas: { where: { ativa: true } },
        elegibilidades: { where: { unidadeId }, include: { unidade: true } },
      },
    },
    membro: {
      select: { id: true, nomeCompleto: true, dataNascimento: true, parentesco: true },
    },
    atendimento: { include: { vitais: true } },
  }) satisfies Prisma.AgendamentoInclude;

@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  /** Janela [00:00, 24:00) do dia em America/Sao_Paulo, independente do TZ do servidor. */
  private janelaDoDia(data?: string) {
    const dia =
      data ??
      // en-CA formata como YYYY-MM-DD; o timeZone resolve "que dia é hoje" em SP.
      new Intl.DateTimeFormat("en-CA", { timeZone: TZ_NEGOCIO }).format(new Date());
    const inicio = new Date(`${dia}T00:00:00${OFFSET_SP}`);
    if (Number.isNaN(inicio.getTime())) {
      throw new BadRequestException("Data inválida — use o formato AAAA-MM-DD.");
    }
    const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
    return { inicio, fim, dia };
  }

  async listarDia(user: AuthenticatedUser, data?: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    const { inicio, fim, dia } = this.janelaDoDia(data);

    const items = await this.prisma.agendamento.findMany({
      where: {
        profissionalId: profissional.id,
        inicioEm: { gte: inicio, lt: fim },
      },
      orderBy: { inicioEm: "asc" },
      include: agendaInclude,
    });

    // Leitura de PII (nome/nascimento de pacientes do dia) entra na trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "Agendamento",
      metadados: { contexto: "medico.listarDia", dia, resultados: items.length },
    });
    return { items, dia };
  }

  async prancha(user: AuthenticatedUser, agendamentoId: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);

    const agendamento = await this.prisma.agendamento.findUnique({
      where: { id: agendamentoId },
      include: pranchaInclude(profissional.unidadeId),
    });
    if (!agendamento) throw new NotFoundException("Agendamento não encontrado");
    this.profissionais.assertOwnership(agendamento.profissionalId, profissional, user);

    // Prontuário é dado sensível — leitura entra na trilha LGPD. Antes do
    // atendimento existir, a entidade auditada é o próprio agendamento
    // (entidadeId nunca fica null).
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: agendamento.atendimento ? "Atendimento" : "Agendamento",
      entidadeId: agendamento.atendimento?.id ?? agendamento.id,
      metadados: { agendamentoId, fichaId: agendamento.fichaId },
    });

    return agendamento;
  }

  /** Busca enxuta de pacientes para agendar — só o necessário (privacidade). */
  async buscarFichas(user: AuthenticatedUser, q?: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    const termo = q?.trim();
    if (!termo || termo.length < 2) return { items: [] };

    const digitos = termo.replace(/\D/g, "");
    const pat = `%${termo}%`;
    // Recorte de tenant: só fichas com elegibilidade APROVADA na unidade do
    // profissional — sem o JOIN a busca enumerava PII de qualquer cidadão da
    // base e o CPF virava oráculo (achado ALTA do review).
    // unaccent: "joao" encontra "João" (extensão criada na migration 20260610150000)
    const linhas = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT f.id FROM fichas_cidadas f
      JOIN elegibilidades e ON e."fichaId" = f.id
        AND e."unidadeId" = ${profissional.unidadeId}
        AND e.status = 'APROVADO'::"StatusElegibilidade"
      WHERE f.ativa = true AND (
        unaccent(lower(f."nomeCompleto")) LIKE unaccent(lower(${pat}))
        OR f.protocolo LIKE ${`%${termo.toUpperCase()}%`}
        OR (length(${digitos}) >= 3 AND f.cpf LIKE ${`%${digitos}%`})
      )
      ORDER BY f."nomeCompleto" ASC
      LIMIT 10
    `;

    // Busca lê dado pessoal — entra na trilha LGPD mesmo quando vazia.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "FichaCidada",
      metadados: { contexto: "medico.buscarFichas", resultados: linhas.length },
    });

    if (linhas.length === 0) return { items: [] };

    const items = await this.prisma.fichaCidada.findMany({
      where: { id: { in: linhas.map((l) => l.id) } },
      orderBy: { nomeCompleto: "asc" },
      select: {
        id: true,
        protocolo: true,
        nomeCompleto: true,
        dataNascimento: true,
        membros: { select: { id: true, nomeCompleto: true, parentesco: true } },
      },
    });
    return { items };
  }

  /** Agenda um paciente para o profissional logado. */
  async criarAgendamento(user: AuthenticatedUser, dto: CriarAgendamentoDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);

    const ficha = await this.prisma.fichaCidada.findUnique({
      where: { id: dto.fichaId },
      select: { id: true },
    });
    if (!ficha) throw new NotFoundException("Ficha do paciente não encontrada");

    // Regra de ouro (mesma da Capacitação): só atende quem o Serviço Social
    // aprovou para ESTA unidade — também impede agendar ficha de outro tenant.
    const elegivel = await this.prisma.elegibilidadePorUnidade.findFirst({
      where: {
        fichaId: dto.fichaId,
        unidadeId: profissional.unidadeId,
        status: StatusElegibilidade.APROVADO,
      },
      select: { id: true },
    });
    if (!elegivel) {
      throw new BadRequestException(
        "Esta família não tem elegibilidade APROVADA nesta unidade — encaminhe ao Serviço Social.",
      );
    }

    if (dto.membroId) {
      const membro = await this.prisma.membroFamiliar.findFirst({
        where: { id: dto.membroId, fichaId: dto.fichaId },
        select: { id: true },
      });
      if (!membro) {
        throw new BadRequestException("O dependente não pertence a esta família.");
      }
    }

    const inicio = new Date(dto.inicioEm);
    const fim = dto.fimEm
      ? new Date(dto.fimEm)
      : new Date(inicio.getTime() + 30 * 60 * 1000);
    if (fim <= inicio) {
      throw new BadRequestException("O fim do agendamento deve ser depois do início.");
    }

    const agendamento = await this.prisma.agendamento.create({
      data: {
        unidadeId: profissional.unidadeId,
        fichaId: dto.fichaId,
        membroId: dto.membroId,
        profissionalId: profissional.id,
        inicioEm: inicio,
        fimEm: fim,
        status: StatusAgendamento.CONFIRMADO,
        motivo: dto.motivo,
        criadoPor: user.id,
      },
      include: agendaInclude,
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Agendamento",
      entidadeId: agendamento.id,
      metadados: { fichaId: dto.fichaId, inicioEm: inicio.toISOString() },
    });

    return agendamento;
  }

  /** Cria o atendimento do agendamento (idempotente: se já existe, retorna o existente). */
  async iniciar(user: AuthenticatedUser, agendamentoId: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);

    const agendamento = await this.prisma.agendamento.findUnique({
      where: { id: agendamentoId },
      include: { atendimento: { include: { vitais: true } } },
    });
    if (!agendamento) throw new NotFoundException("Agendamento não encontrado");
    this.profissionais.assertOwnership(agendamento.profissionalId, profissional, user);

    if (agendamento.atendimento) {
      // Caminho idempotente também devolve prontuário (vitais) — audita a leitura.
      this.audit.registrar({
        userId: user.id,
        acao: AcaoAuditoria.READ,
        entidade: "Atendimento",
        entidadeId: agendamento.atendimento.id,
        metadados: { agendamentoId, contexto: "iniciar.idempotente" },
      });
      return agendamento.atendimento;
    }

    let atendimento;
    try {
      atendimento = await this.prisma.$transaction(async (tx) => {
        const criado = await tx.atendimento.create({
          data: {
            unidadeId: agendamento.unidadeId,
            fichaId: agendamento.fichaId,
            membroId: agendamento.membroId,
            profissionalId: agendamento.profissionalId,
            agendamentoId: agendamento.id,
          },
          include: { vitais: true },
        });
        await tx.agendamento.update({
          where: { id: agendamento.id },
          data: { status: StatusAgendamento.EM_ATENDIMENTO },
        });
        return criado;
      });
    } catch (e) {
      // Dois cliques simultâneos: o unique de agendamentoId derruba o segundo
      // create (P2002) — devolve o atendimento vencedor em vez de 500.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const existente = await this.prisma.atendimento.findUnique({
          where: { agendamentoId },
          include: { vitais: true },
        });
        if (existente) return existente;
      }
      throw e;
    }

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Atendimento",
      entidadeId: atendimento.id,
      metadados: { agendamentoId, fichaId: agendamento.fichaId },
    });

    return atendimento;
  }

  /**
   * Resolve o acesso ao balcão do Centro Médico. ehBalcao=true para quem opera a
   * unidade inteira (SUPER_ADMIN, ou GESTOR_UNIDADE/RECEPCAO lotado na unidade);
   * para o PROFISSIONAL puro, ehBalcao=false e ele só mexe nos próprios.
   */
  private async acessoBalcao(
    user: AuthenticatedUser,
  ): Promise<{ unidadeId: string; profissionalId: string | null; ehBalcao: boolean }> {
    const unidade = await this.prisma.unidade.findUnique({
      where: { tipo: TipoUnidade.MEDICO },
      select: { id: true },
    });
    if (!unidade) throw new NotFoundException("Unidade médica não encontrada");

    const prof = await this.prisma.profissional.findUnique({
      where: { userId: user.id },
      select: { id: true, ativo: true, unidadeId: true },
    });
    const profissionalId = prof?.ativo && prof.unidadeId === unidade.id ? prof.id : null;

    if (user.perfis.includes(Perfil.SUPER_ADMIN)) {
      return { unidadeId: unidade.id, profissionalId, ehBalcao: true };
    }
    const ehGestorOuRecepcao = user.perfis.some(
      (p) => p === Perfil.GESTOR_UNIDADE || p === Perfil.RECEPCAO,
    );
    if (ehGestorOuRecepcao) {
      const lotado = await this.prisma.usuarioUnidade.findFirst({
        where: { userId: user.id, unidadeId: unidade.id },
        select: { id: true },
      });
      if (lotado) return { unidadeId: unidade.id, profissionalId, ehBalcao: true };
    }
    if (profissionalId) return { unidadeId: unidade.id, profissionalId, ehBalcao: false };

    throw new ForbiddenException("Sem acesso à agenda do Centro Médico.");
  }

  /** Fila do dia da UNIDADE (todos os profissionais) — para o balcão/recepção. */
  async filaUnidade(user: AuthenticatedUser, data?: string) {
    const { unidadeId } = await this.acessoBalcao(user);
    const { inicio, fim, dia } = this.janelaDoDia(data);

    const items = await this.prisma.agendamento.findMany({
      where: { unidadeId, inicioEm: { gte: inicio, lt: fim } },
      orderBy: { inicioEm: "asc" },
      include: {
        ...agendaInclude,
        profissional: { select: { user: { select: { nome: true } } } },
      },
    });
    // Fila da unidade expõe nome dos pacientes de todos os profissionais — audit READ.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "Agendamento",
      metadados: { contexto: "medico.filaUnidade", dia, resultados: items.length },
    });
    return { items, dia };
  }

  /** Gestão do agendamento: confirmar, marcar falta, cancelar ou reagendar. */
  async atualizarAgendamento(
    user: AuthenticatedUser,
    agendamentoId: string,
    dto: {
      status?: StatusAgendamento;
      inicioEm?: string;
      fimEm?: string;
      motivo?: string;
    },
  ) {
    const { unidadeId, profissionalId, ehBalcao } = await this.acessoBalcao(user);
    const ag = await this.prisma.agendamento.findUnique({ where: { id: agendamentoId } });
    if (!ag || ag.unidadeId !== unidadeId) {
      throw new NotFoundException("Agendamento não encontrado");
    }
    // Profissional puro só mexe nos seus; o balcão gere qualquer um da unidade.
    if (!ehBalcao && ag.profissionalId !== profissionalId) {
      throw new ForbiddenException("Este agendamento pertence a outro profissional.");
    }

    if (
      ag.status === StatusAgendamento.EM_ATENDIMENTO ||
      ag.status === StatusAgendamento.CONCLUIDO
    ) {
      throw new BadRequestException(
        "O atendimento já foi iniciado — não dá para alterar este agendamento.",
      );
    }

    const data: Prisma.AgendamentoUpdateInput = {};

    if (dto.status) {
      const permitidos: StatusAgendamento[] = [
        StatusAgendamento.AGENDADO,
        StatusAgendamento.CONFIRMADO,
        StatusAgendamento.FALTOU,
        StatusAgendamento.CANCELADO,
      ];
      if (!permitidos.includes(dto.status)) {
        throw new BadRequestException("Use apenas confirmar, falta, cancelar ou reagendar.");
      }
      data.status = dto.status;
    }

    if (dto.inicioEm || dto.fimEm) {
      const inicio = dto.inicioEm ? new Date(dto.inicioEm) : ag.inicioEm;
      const fim = dto.fimEm
        ? new Date(dto.fimEm)
        : dto.inicioEm
          ? new Date(inicio.getTime() + 30 * 60 * 1000)
          : ag.fimEm;
      if (fim <= inicio) {
        throw new BadRequestException("O fim do agendamento deve ser depois do início.");
      }
      data.inicioEm = inicio;
      data.fimEm = fim;
    }

    if (dto.motivo !== undefined) data.motivo = dto.motivo;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException("Nada para atualizar.");
    }

    const atualizado = await this.prisma.agendamento.update({
      where: { id: agendamentoId },
      data,
      include: agendaInclude,
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Agendamento",
      entidadeId: agendamentoId,
      metadados: { campos: Object.keys(dto) },
    });

    return atualizado;
  }
}
