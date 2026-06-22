import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AcaoAuditoria, PrioridadeTriagem, Prisma, StatusTriagem } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { CriarTriagemDto } from "./dto/criar-triagem.dto";

const triagemInclude = {
  ficha: {
    select: { id: true, protocolo: true, nomeCompleto: true, telefone: true, dataNascimento: true },
  },
} satisfies Prisma.TriagemInclude;

/** Dias de espera desde a abertura da triagem (inteiro, piso). */
function diasEspera(criadoEm: Date): number {
  return Math.floor((Date.now() - criadoEm.getTime()) / 86_400_000);
}

interface ListarParams {
  status?: StatusTriagem;
  prioridade?: PrioridadeTriagem;
  page?: number;
  perPage?: number;
}

/**
 * Serviço Social — fila de Triagem (porta de entrada das famílias).
 * Papel CROSS-UNIDADE (sem tenant de unidade); RBAC SERVICO_SOCIAL no controller.
 */
@Injectable()
export class TriagemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listar(user: AuthenticatedUser, { status, prioridade, page = 1, perPage = 20 }: ListarParams) {
    const where: Prisma.TriagemWhereInput = {
      ...(status ? { status } : {}),
      ...(prioridade ? { prioridade } : {}),
    };
    const [rows, total, naFila, prioritarias] = await this.prisma.$transaction([
      this.prisma.triagem.findMany({
        where,
        include: triagemInclude,
        // URGENTE primeiro (enum desc), e dentro da prioridade os mais antigos.
        orderBy: [{ prioridade: "desc" }, { criadoEm: "asc" }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.triagem.count({ where }),
      this.prisma.triagem.count({ where: { status: StatusTriagem.PENDENTE } }),
      this.prisma.triagem.count({
        where: {
          status: StatusTriagem.PENDENTE,
          prioridade: { in: [PrioridadeTriagem.ALTA, PrioridadeTriagem.URGENTE] },
        },
      }),
    ]);

    // Leitura de dado pessoal entra na trilha LGPD mesmo quando vazia.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "Triagem",
      metadados: { contexto: "lista", resultados: rows.length },
    });

    const items = rows.map((t) => ({ ...t, diasEspera: diasEspera(t.criadoEm) }));
    const maiorEsperaDias = items.reduce(
      (m, t) => (t.status !== StatusTriagem.CONCLUIDA && t.diasEspera > m ? t.diasEspera : m),
      0,
    );

    return {
      items,
      kpis: { naFila, prioritarias, maiorEsperaDias },
      pagination: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
    };
  }

  async criar(user: AuthenticatedUser, dto: CriarTriagemDto) {
    const ficha = await this.prisma.fichaCidada.findUnique({
      where: { id: dto.fichaId },
      select: { id: true },
    });
    if (!ficha) throw new NotFoundException("Ficha não encontrada.");

    const triagem = await this.prisma.triagem.create({
      data: {
        fichaId: dto.fichaId,
        prioridade: dto.prioridade,
        motivoSolicitacao: dto.motivoSolicitacao,
        criadoPor: user.id,
      },
      include: triagemInclude,
    });
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Triagem",
      entidadeId: triagem.id,
      metadados: { fichaId: dto.fichaId },
    });
    return { ...triagem, diasEspera: diasEspera(triagem.criadoEm) };
  }

  async detalhe(user: AuthenticatedUser, id: string) {
    const triagem = await this.prisma.triagem.findUnique({ where: { id }, include: triagemInclude });
    if (!triagem) throw new NotFoundException("Triagem não encontrada.");
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "Triagem",
      entidadeId: id,
    });
    return { ...triagem, diasEspera: diasEspera(triagem.criadoEm) };
  }

  async iniciar(user: AuthenticatedUser, id: string) {
    // updateMany condicional: serializa transições concorrentes (sem janela de race).
    const r = await this.prisma.triagem.updateMany({
      where: { id, status: StatusTriagem.PENDENTE },
      data: { status: StatusTriagem.EM_ANDAMENTO, iniciadaEm: new Date() },
    });
    if (r.count === 0) {
      throw new ConflictException("Triagem não está pendente (já iniciada ou concluída).");
    }
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Triagem",
      entidadeId: id,
      metadados: { acao: "iniciar" },
    });
    return this.detalhe(user, id);
  }

  async concluir(user: AuthenticatedUser, id: string) {
    const r = await this.prisma.triagem.updateMany({
      where: { id, status: StatusTriagem.EM_ANDAMENTO },
      data: { status: StatusTriagem.CONCLUIDA, concluidaEm: new Date() },
    });
    if (r.count === 0) {
      throw new ConflictException("Só é possível concluir uma triagem EM ANDAMENTO.");
    }
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Triagem",
      entidadeId: id,
      metadados: { acao: "concluir" },
    });
    return this.detalhe(user, id);
  }
}
