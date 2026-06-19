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
  StatusPresenca,
  StatusTurma,
  TipoUnidade,
} from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { CriarMatriculaDto } from "./dto/criar-matricula.dto";
import type { CriarTurmaDto } from "./dto/criar-turma.dto";
import { ProfissionaisService } from "../medico/profissionais.service";

const turmaDetalheInclude = {
  curso: true,
  instrutor: { include: { user: { select: { nome: true } } } },
  aulas: { orderBy: { data: "asc" as const } },
  matriculas: {
    include: {
      ficha: { select: { id: true, protocolo: true, nomeCompleto: true } },
      membro: { select: { id: true, nomeCompleto: true } },
      certificado: true,
      presencas: { where: { aula: { encerradaEm: { not: null } } } },
    },
  },
} satisfies Prisma.TurmaInclude;

@Injectable()
export class TurmasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  /** % de presença sobre as aulas ENCERRADAS (PRESENTE e JUSTIFICADA contam). */
  private presencaPct(
    presencas: { status: StatusPresenca }[],
    totalAulasEncerradas: number,
  ): number {
    if (totalAulasEncerradas === 0) return 0;
    const validas = presencas.filter((p) => p.status !== StatusPresenca.FALTA).length;
    return (validas / totalAulasEncerradas) * 100;
  }

  async listar(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const items = await this.prisma.turma.findMany({
      where: { unidadeId: profissional.unidadeId },
      orderBy: { criadoEm: "desc" },
      include: {
        curso: true,
        _count: { select: { matriculas: true, aulas: true } },
      },
    });
    return { items };
  }

  /** Cursos ativos da unidade (para o formulário de nova turma). */
  async cursos(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const items = await this.prisma.curso.findMany({
      where: { unidadeId: profissional.unidadeId, ativo: true },
      orderBy: { nome: "asc" },
    });
    return { items };
  }

  /** KPIs da unidade (dashboard). */
  async resumo(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const unidadeId = profissional.unidadeId;
    const [turmasEmAndamento, alunosAtivos, certificadosEmitidos, listaEspera] =
      await this.prisma.$transaction([
        this.prisma.turma.count({
          where: { unidadeId, status: StatusTurma.EM_ANDAMENTO },
        }),
        this.prisma.matricula.count({
          where: { unidadeId, status: StatusMatricula.ATIVA },
        }),
        this.prisma.certificado.count({ where: { unidadeId } }),
        this.prisma.matricula.count({
          where: { unidadeId, status: StatusMatricula.LISTA_ESPERA },
        }),
      ]);
    return { turmasEmAndamento, alunosAtivos, certificadosEmitidos, listaEspera };
  }

  /** Fichas APROVADAS na Capacitação (para o formulário de matrícula). */
  async fichasElegiveis(user: AuthenticatedUser, q?: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
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
      metadados: { contexto: "capacitacao.fichasElegiveis", resultados: linhas.length },
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
  async criar(user: AuthenticatedUser, dto: CriarTurmaDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);

    const curso = await this.prisma.curso.findFirst({
      where: { id: dto.cursoId, unidadeId: profissional.unidadeId, ativo: true },
    });
    if (!curso) throw new NotFoundException("Curso não encontrado nesta unidade");

    const codigoExiste = await this.prisma.turma.findUnique({
      where: { codigo: dto.codigo },
      select: { id: true },
    });
    if (codigoExiste) {
      throw new ConflictException(`Já existe uma turma com o código ${dto.codigo}.`);
    }

    const turma = await this.prisma.turma.create({
      data: {
        unidadeId: profissional.unidadeId,
        cursoId: curso.id,
        codigo: dto.codigo,
        profissionalId: profissional.id,
        diasHorario: dto.diasHorario,
        sala: dto.sala,
        inicioEm: new Date(dto.inicioEm),
        vagasTotais: dto.vagasTotais,
        status: StatusTurma.EM_ANDAMENTO,
      },
      include: { curso: true, _count: { select: { matriculas: true, aulas: true } } },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Turma",
      entidadeId: turma.id,
      metadados: { codigo: turma.codigo, curso: curso.nome },
    });

    return turma;
  }

  /** Matricula respeitando a regra de ouro (elegibilidade APROVADA) e as vagas. */
  async matricular(user: AuthenticatedUser, turmaId: string, dto: CriarMatriculaDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const turma = await this.prisma.turma.findUnique({
      where: { id: turmaId },
      select: { id: true, unidadeId: true, profissionalId: true, status: true },
    });
    if (!turma) throw new NotFoundException("Turma não encontrada");
    this.profissionais.assertOwnership(turma.profissionalId, profissional, user);
    if (turma.status === StatusTurma.ENCERRADA) {
      throw new BadRequestException("A turma já foi encerrada.");
    }

    // Regra de ouro: só matricula quem o Serviço Social aprovou para a Capacitação.
    const elegivel = await this.prisma.elegibilidadePorUnidade.findFirst({
      where: {
        fichaId: dto.fichaId,
        unidadeId: turma.unidadeId,
        status: StatusElegibilidade.APROVADO,
      },
    });
    if (!elegivel) {
      throw new BadRequestException(
        "Esta família não tem elegibilidade APROVADA na Capacitação — encaminhe ao Serviço Social.",
      );
    }

    // Lock da linha da turma: matrículas concorrentes serializam aqui — mata o
    // overbooking (contagem sempre fresca), a posição de espera duplicada e a
    // matrícula dupla do titular (o unique composto não cobre membroId NULL).
    const matricula = await this.prisma.$transaction(async (tx) => {
      const [lockada] = await tx.$queryRaw<{ vagasTotais: number; status: string }[]>`
        SELECT "vagasTotais", status FROM turmas WHERE id = ${turmaId} FOR UPDATE
      `;
      if (!lockada) throw new NotFoundException("Turma não encontrada");
      if (lockada.status === StatusTurma.ENCERRADA) {
        throw new BadRequestException("A turma já foi encerrada.");
      }

      const duplicada = await tx.matricula.findFirst({
        where: { turmaId, fichaId: dto.fichaId, membroId: dto.membroId ?? null },
        select: { id: true },
      });
      if (duplicada) {
        throw new ConflictException("Este aluno já está matriculado nesta turma.");
      }

      const ativas = await tx.matricula.count({
        where: { turmaId, status: StatusMatricula.ATIVA },
      });
      const temVaga = ativas < lockada.vagasTotais;
      let posicaoEspera: number | null = null;
      if (!temVaga) {
        const naEspera = await tx.matricula.count({
          where: { turmaId, status: StatusMatricula.LISTA_ESPERA },
        });
        posicaoEspera = naEspera + 1;
      }

      return tx.matricula.create({
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
      entidade: "Matricula",
      entidadeId: matricula.id,
      metadados: { turmaId, status: matricula.status },
    });

    return matricula;
  }

  async detalhe(user: AuthenticatedUser, id: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const turma = await this.prisma.turma.findUnique({
      where: { id },
      include: turmaDetalheInclude,
    });
    if (!turma) throw new NotFoundException("Turma não encontrada");
    // Tenant: dados de alunos só para a unidade da turma (SUPER_ADMIN passa).
    if (
      !user.perfis.includes(Perfil.SUPER_ADMIN) &&
      turma.unidadeId !== profissional.unidadeId
    ) {
      throw new ForbiddenException("Esta turma pertence a outra unidade.");
    }

    // Detalhe expõe nomes e presença dos alunos — leitura entra na trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "Turma",
      entidadeId: id,
      metadados: { contexto: "detalhe", matriculas: turma.matriculas.length },
    });

    const aulasEncerradas = turma.aulas.filter((a) => a.encerradaEm).length;
    const matriculas = turma.matriculas.map(({ presencas, ...m }) => ({
      ...m,
      presencaPct: Number(this.presencaPct(presencas, aulasEncerradas).toFixed(1)),
    }));

    return { ...turma, matriculas, aulasEncerradas };
  }

  /** Encerra a turma e emite certificados para quem atingiu a presença mínima. */
  async encerrar(user: AuthenticatedUser, id: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const previa = await this.prisma.turma.findUnique({
      where: { id },
      select: { id: true, profissionalId: true, status: true },
    });
    if (!previa) throw new NotFoundException("Turma não encontrada");
    this.profissionais.assertOwnership(previa.profissionalId, profissional, user);
    if (previa.status === StatusTurma.ENCERRADA) {
      throw new ConflictException("Turma já encerrada.");
    }

    // Tudo dentro da transação, com lock na turma: o snapshot de presenças é
    // lido DEPOIS do lock (nenhuma chamada concorrente muda o resultado) e dois
    // encerramentos simultâneos não emitem certificado duplicado.
    const resultado = await this.prisma.$transaction(async (tx) => {
      const [lockada] = await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM turmas WHERE id = ${id} FOR UPDATE
      `;
      if (!lockada) throw new NotFoundException("Turma não encontrada");
      if (lockada.status === StatusTurma.ENCERRADA) {
        throw new ConflictException("Turma já encerrada.");
      }

      const turma = await tx.turma.findUniqueOrThrow({
        where: { id },
        include: turmaDetalheInclude,
      });

      // O certificado atesta carga horária do curso inteiro — toda aula criada
      // precisa estar encerrada para o % de presença refletir o curso completo.
      const abertas = turma.aulas.filter((a) => !a.encerradaEm).length;
      if (abertas > 0) {
        throw new BadRequestException(
          `Há ${abertas} aula(s) sem selo — encerre todas as aulas antes de encerrar a turma.`,
        );
      }
      const aulasEncerradas = turma.aulas.length;
      if (aulasEncerradas === 0) {
        throw new BadRequestException(
          "Encerre ao menos uma aula com chamada antes de encerrar a turma.",
        );
      }

      const codigos: string[] = [];
      let evadidas = 0;
      let esperaCanceladas = 0;

      for (const mat of turma.matriculas) {
        // Lista de espera nunca atendida morre no encerramento (não é evasão —
        // o aluno nunca cursou; sem isso o KPI de espera ficava inflado p/ sempre).
        if (mat.status === StatusMatricula.LISTA_ESPERA) {
          await tx.matricula.update({
            where: { id: mat.id },
            data: { status: StatusMatricula.CANCELADA },
          });
          esperaCanceladas++;
          continue;
        }
        if (mat.status !== StatusMatricula.ATIVA) continue;
        const pct = this.presencaPct(mat.presencas, aulasEncerradas);

        if (pct >= turma.curso.presencaMinimaPct) {
          const cert = await tx.certificado.create({
            data: {
              unidadeId: turma.unidadeId,
              matriculaId: mat.id,
              cargaHorariaCumprida: Math.round(
                (turma.curso.cargaHorariaTotal * pct) / 100,
              ),
              presencaPct: new Prisma.Decimal(pct.toFixed(2)),
              emitidoPor: user.id,
            },
          });
          codigos.push(cert.codigoVerificacao);
          await tx.matricula.update({
            where: { id: mat.id },
            data: { status: StatusMatricula.CONCLUIDA },
          });
        } else {
          evadidas++;
          await tx.matricula.update({
            where: { id: mat.id },
            data: { status: StatusMatricula.EVADIDA },
          });
        }
      }
      await tx.turma.update({
        where: { id },
        data: { status: StatusTurma.ENCERRADA, fimEm: new Date() },
      });

      return { codigos, evadidas, esperaCanceladas, aulasEncerradas };
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Turma",
      entidadeId: id,
      metadados: {
        acao: "encerramento",
        certificadosEmitidos: resultado.codigos.length,
        evadidas: resultado.evadidas,
        esperaCanceladas: resultado.esperaCanceladas,
        // Trilha do que sustenta a carga horária dos certificados emitidos.
        aulasEncerradas: resultado.aulasEncerradas,
      },
    });

    return {
      certificadosEmitidos: resultado.codigos.length,
      evadidas: resultado.evadidas,
      esperaCanceladas: resultado.esperaCanceladas,
      codigos: resultado.codigos,
    };
  }

  /** Tranca, cancela ou reativa uma matrícula (remover/repor aluno na turma). */
  async alterarMatricula(
    user: AuthenticatedUser,
    matriculaId: string,
    novoStatus: StatusMatricula,
  ) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const mat = await this.prisma.matricula.findUnique({
      where: { id: matriculaId },
      include: {
        turma: { select: { id: true, profissionalId: true, status: true } },
      },
    });
    if (!mat) throw new NotFoundException("Matrícula não encontrada");
    this.profissionais.assertOwnership(mat.turma.profissionalId, profissional, user);

    if (mat.turma.status === StatusTurma.ENCERRADA) {
      throw new BadRequestException("A turma já foi encerrada.");
    }
    const permitidos: StatusMatricula[] = [
      StatusMatricula.ATIVA,
      StatusMatricula.TRANCADA,
      StatusMatricula.CANCELADA,
    ];
    if (!permitidos.includes(novoStatus)) {
      throw new BadRequestException("Use apenas ativar, trancar ou cancelar.");
    }
    if (mat.status === StatusMatricula.CONCLUIDA || mat.status === StatusMatricula.EVADIDA) {
      throw new BadRequestException("Esta matrícula já foi finalizada.");
    }
    if (mat.status === novoStatus) return mat;

    // Reativar precisa de vaga: lock da turma serializa contra matrículas concorrentes.
    if (novoStatus === StatusMatricula.ATIVA) {
      const atualizada = await this.prisma.$transaction(async (tx) => {
        const [lock] = await tx.$queryRaw<{ vagasTotais: number }[]>`
          SELECT "vagasTotais" FROM turmas WHERE id = ${mat.turma.id} FOR UPDATE
        `;
        if (!lock) throw new NotFoundException("Turma não encontrada");
        const ativas = await tx.matricula.count({
          where: { turmaId: mat.turma.id, status: StatusMatricula.ATIVA },
        });
        if (ativas >= lock.vagasTotais) {
          throw new BadRequestException("Turma lotada — não há vaga para reativar.");
        }
        return tx.matricula.update({
          where: { id: matriculaId },
          data: { status: StatusMatricula.ATIVA, posicaoEspera: null },
        });
      });
      this.audit.registrar({
        userId: user.id,
        acao: AcaoAuditoria.UPDATE,
        entidade: "Matricula",
        entidadeId: matriculaId,
        metadados: { status: StatusMatricula.ATIVA },
      });
      return atualizada;
    }

    // Trancar/cancelar libera a vaga (zera posição de espera).
    const atualizada = await this.prisma.matricula.update({
      where: { id: matriculaId },
      data: { status: novoStatus, posicaoEspera: null },
    });
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Matricula",
      entidadeId: matriculaId,
      metadados: { status: novoStatus },
    });
    return atualizada;
  }

  /** Certificados emitidos na unidade (consulta/segunda via). */
  async certificados(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const items = await this.prisma.certificado.findMany({
      where: { unidadeId: profissional.unidadeId },
      orderBy: { emitidoEm: "desc" },
      select: {
        id: true,
        codigoVerificacao: true,
        cargaHorariaCumprida: true,
        presencaPct: true,
        emitidoEm: true,
        matricula: {
          select: {
            ficha: { select: { nomeCompleto: true } },
            membro: { select: { nomeCompleto: true } },
            turma: { select: { codigo: true, curso: { select: { nome: true } } } },
          },
        },
      },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "Certificado",
      metadados: { contexto: "listagem", total: items.length },
    });

    return {
      items: items.map((c) => ({
        id: c.id,
        codigoVerificacao: c.codigoVerificacao,
        cargaHorariaCumprida: c.cargaHorariaCumprida,
        presencaPct: Number(c.presencaPct),
        emitidoEm: c.emitidoEm,
        aluno: c.matricula.membro?.nomeCompleto ?? c.matricula.ficha.nomeCompleto,
        curso: c.matricula.turma.curso.nome,
        turma: c.matricula.turma.codigo,
      })),
    };
  }
}
