import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AcaoAuditoria, Prisma, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { CreateDocumentoDto } from "./dto/create-documento.dto";
import type { RevogarDocumentoDto } from "./dto/revogar-documento.dto";
import { ProfissionaisService } from "./profissionais.service";

const MSG_SELADO =
  "Atendimento já encerrado — emita o documento durante o atendimento aberto.";

@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  /**
   * Emite um documento médico (atestado/receita/declaração) para o atendimento.
   * Mesma disciplina da prescrição: só durante o atendimento aberto (selo bloqueia).
   * O `codigoVerificacao` (cuid) é gerado pelo banco e habilita a verificação pública.
   */
  async emitir(user: AuthenticatedUser, atendimentoId: string, dto: CreateDocumentoDto) {
    const profissional = await this.profissionais.resolverPorUser(
      user,
      TipoUnidade.MEDICO,
    );
    const atendimento = await this.prisma.atendimento.findUnique({
      where: { id: atendimentoId },
      select: {
        id: true,
        unidadeId: true,
        fichaId: true,
        membroId: true,
        profissionalId: true,
        encerradoEm: true,
      },
    });
    if (!atendimento) throw new NotFoundException("Atendimento não encontrado");
    this.profissionais.assertOwnership(atendimento.profissionalId, profissional, user);

    // Re-checa o selo sob lock — sem janela para emitir em prontuário selado.
    const documento = await this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ encerradoEm: Date | null }[]>`
        SELECT "encerradoEm" FROM atendimentos WHERE id = ${atendimentoId} FOR UPDATE
      `;
      if (!row) throw new NotFoundException("Atendimento não encontrado");
      if (row.encerradoEm) throw new ConflictException(MSG_SELADO);

      return tx.documentoMedico.create({
        data: {
          unidadeId: atendimento.unidadeId,
          atendimentoId: atendimento.id,
          fichaId: atendimento.fichaId,
          membroId: atendimento.membroId,
          profissionalId: atendimento.profissionalId,
          tipo: dto.tipo,
          conteudo: dto.conteudo,
          cid10: dto.cid10 ?? null,
          diasAfastamento: dto.diasAfastamento ?? null,
          emitidoPor: user.id,
        },
      });
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "DocumentoMedico",
      entidadeId: documento.id,
      metadados: { atendimentoId, tipo: dto.tipo },
    });

    return documento;
  }

  /** Lista os documentos de um atendimento (lê dado clínico → audita READ). */
  async listarDoAtendimento(user: AuthenticatedUser, atendimentoId: string) {
    const profissional = await this.profissionais.resolverPorUser(
      user,
      TipoUnidade.MEDICO,
    );
    const atendimento = await this.prisma.atendimento.findUnique({
      where: { id: atendimentoId },
      select: { id: true, profissionalId: true },
    });
    if (!atendimento) throw new NotFoundException("Atendimento não encontrado");
    this.profissionais.assertOwnership(atendimento.profissionalId, profissional, user);

    const itens = await this.prisma.documentoMedico.findMany({
      where: { atendimentoId },
      orderBy: { emitidoEm: "desc" },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "DocumentoMedico",
      entidadeId: atendimentoId,
      metadados: { contexto: "lista.atendimento", total: itens.length },
    });

    return { items: itens };
  }

  /**
   * Revoga um documento emitido (documento é imutável; corrige-se revogando).
   * Idempotência atômica: o WHERE inclui revogadoEm null — revogar de novo → 409.
   */
  async revogar(user: AuthenticatedUser, id: string, dto: RevogarDocumentoDto) {
    const profissional = await this.profissionais.resolverPorUser(
      user,
      TipoUnidade.MEDICO,
    );
    const doc = await this.prisma.documentoMedico.findUnique({
      where: { id },
      select: { id: true, profissionalId: true, revogadoEm: true },
    });
    if (!doc) throw new NotFoundException("Documento não encontrado");
    this.profissionais.assertOwnership(doc.profissionalId, profissional, user);

    const r = await this.prisma.documentoMedico.updateMany({
      where: { id, revogadoEm: null },
      data: { revogadoEm: new Date(), revogadoMotivo: dto.motivo },
    });
    if (r.count === 0) {
      throw new ConflictException("Documento já estava revogado.");
    }

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "DocumentoMedico",
      entidadeId: id,
      metadados: { acao: "revogacao", motivo: dto.motivo },
    });

    return this.prisma.documentoMedico.findUniqueOrThrow({ where: { id } });
  }
}

export type DocumentoMedicoComRelacoes = Prisma.DocumentoMedicoGetPayload<
  Record<string, never>
>;
