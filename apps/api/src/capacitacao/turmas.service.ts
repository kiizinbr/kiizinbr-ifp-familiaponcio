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

  /**
   * Turmas da unidade com filtros opcionais (status/curso) e % de ocupação por
   * turma (atletas ATIVOS sobre as vagas). Só agregado — sem PII de aluno.
   */
  async listar(
    user: AuthenticatedUser,
    filtros: { status?: string; cursoId?: string } = {},
  ) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);

    const statusValido =
      filtros.status && (Object.values(StatusTurma) as string[]).includes(filtros.status)
        ? (filtros.status as StatusTurma)
        : undefined;

    const turmas = await this.prisma.turma.findMany({
      where: {
        unidadeId: profissional.unidadeId,
        ...(statusValido ? { status: statusValido } : {}),
        ...(filtros.cursoId ? { cursoId: filtros.cursoId } : {}),
      },
      orderBy: { criadoEm: "desc" },
      include: {
        curso: true,
        _count: {
          select: {
            matriculas: true,
            aulas: true,
            // segundo bloco de matrículas só p/ contar as ATIVAS (ocupação real)
          },
        },
      },
    });

    // Ocupação por turma: ATIVAS / vagas. Conta em lote para não dar N+1.
    const ativasPorTurma = await this.prisma.matricula.groupBy({
      by: ["turmaId"],
      where: {
        unidadeId: profissional.unidadeId,
        status: StatusMatricula.ATIVA,
        turmaId: { in: turmas.map((t) => t.id) },
      },
      _count: { _all: true },
    });
    const ativasMap = new Map(ativasPorTurma.map((g) => [g.turmaId, g._count._all]));

    const items = turmas.map((t) => {
      const alunosAtivos = ativasMap.get(t.id) ?? 0;
      return {
        ...t,
        alunosAtivos,
        ocupacaoPct:
          t.vagasTotais > 0 ? Math.round((alunosAtivos / t.vagasTotais) * 100) : null,
      };
    });

    return { items, total: items.length };
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

    // LGPD: matrícula de MENOR (<18) exige o consentimento do responsável (titular).
    const nascimento = await this.dataNascimentoDoAluno(dto.fichaId, dto.membroId);
    const ehMenor = this.idadeEmAnos(nascimento) < 18;
    if (ehMenor && !dto.consentimentoTitular) {
      throw new BadRequestException({
        code: "CONSENTIMENTO_NECESSARIO",
        message:
          "Matrícula de menor de 18 anos exige o consentimento do responsável (titular).",
      });
    }
    const consentidoPorTitularEm = ehMenor ? new Date() : null;

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

      // Regra de ouro: só matricula quem o Serviço Social aprovou para a Capacitação.
      // Lida DENTRO da transação (após o FOR UPDATE) para o snapshot ser consistente.
      const elegivel = await tx.elegibilidadePorUnidade.findFirst({
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
          consentidoPorTitularEm,
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
      metadados: { turmaId, status: matricula.status, menor: ehMenor },
    });

    return matricula;
  }

  /** Idade em anos completos na data de hoje. */
  private idadeEmAnos(nascimento: Date): number {
    const hoje = new Date();
    let anos = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) anos -= 1;
    return anos;
  }

  /** Data de nascimento do aluno matriculado: o dependente (se membroId) ou o titular. */
  private async dataNascimentoDoAluno(fichaId: string, membroId?: string): Promise<Date> {
    if (membroId) {
      const membro = await this.prisma.membroFamiliar.findFirst({
        where: { id: membroId, fichaId },
        select: { dataNascimento: true },
      });
      if (!membro) throw new NotFoundException("Dependente não encontrado nesta família.");
      return membro.dataNascimento;
    }
    const ficha = await this.prisma.fichaCidada.findUnique({
      where: { id: fichaId },
      select: { dataNascimento: true },
    });
    if (!ficha) throw new NotFoundException("Ficha não encontrada.");
    return ficha.dataNascimento;
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
        // Aluno TRANCADO quando a turma encerra não tem como retomar — vira
        // CANCELADA (status terminal), senão fica órfão numa turma ENCERRADA.
        if (mat.status === StatusMatricula.TRANCADA) {
          await tx.matricula.update({
            where: { id: mat.id },
            data: { status: StatusMatricula.CANCELADA },
          });
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

  /** Edita dados operacionais da turma (horário, sala, vagas). */
  async editar(
    user: AuthenticatedUser,
    turmaId: string,
    dto: { diasHorario?: string; sala?: string; vagasTotais?: number },
  ) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const turma = await this.prisma.turma.findUnique({
      where: { id: turmaId },
      select: { id: true, profissionalId: true, status: true },
    });
    if (!turma) throw new NotFoundException("Turma não encontrada");
    this.profissionais.assertOwnership(turma.profissionalId, profissional, user);
    if (turma.status === StatusTurma.ENCERRADA) {
      throw new BadRequestException("A turma já foi encerrada.");
    }

    if (dto.vagasTotais != null) {
      const ativas = await this.prisma.matricula.count({
        where: { turmaId, status: StatusMatricula.ATIVA },
      });
      if (dto.vagasTotais < ativas) {
        throw new BadRequestException(
          `Já há ${ativas} aluno(s) ativo(s) — as vagas não podem ser menores que isso.`,
        );
      }
    }

    const atualizada = await this.prisma.turma.update({
      where: { id: turmaId },
      data: {
        ...(dto.diasHorario ? { diasHorario: dto.diasHorario } : {}),
        ...(dto.sala !== undefined ? { sala: dto.sala } : {}),
        ...(dto.vagasTotais != null ? { vagasTotais: dto.vagasTotais } : {}),
      },
      include: { curso: true, _count: { select: { matriculas: true, aulas: true } } },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Turma",
      entidadeId: turmaId,
      metadados: { campos: Object.keys(dto) },
    });

    return atualizada;
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

  /**
   * Certificados emitidos na unidade (consulta/segunda via). Filtros opcionais
   * (A3, read-only — só estreitam a listagem dentro da própria unidade, sem
   * abrir tenant):
   *  - `q`: busca por nome do aluno (titular/dependente), código de verificação
   *    ou nome do curso. Tudo via filtros do Prisma (`contains`/`mode insensitive`)
   *    → sem SQL concatenado.
   *  - `cursoId`: só os certificados de turmas daquele curso.
   *  - `de`/`ate`: janela de emissão (`emitidoEm`); datas inválidas são ignoradas.
   */
  async certificados(
    user: AuthenticatedUser,
    filtros: { q?: string; cursoId?: string; de?: string; ate?: string } = {},
  ) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);

    const termo = filtros.q?.trim();
    const emitidoEm = this.intervaloData(filtros.de, filtros.ate);

    // Busca textual (insensível a caixa) cobre aluno (titular OU dependente),
    // código do certificado e nome do curso. OR só entra no where quando há termo.
    const buscaTexto = termo
      ? {
          OR: [
            { codigoVerificacao: { contains: termo, mode: "insensitive" as const } },
            {
              matricula: {
                ficha: { nomeCompleto: { contains: termo, mode: "insensitive" as const } },
              },
            },
            {
              matricula: {
                membro: { nomeCompleto: { contains: termo, mode: "insensitive" as const } },
              },
            },
            {
              matricula: {
                turma: { curso: { nome: { contains: termo, mode: "insensitive" as const } } },
              },
            },
          ],
        }
      : {};

    const items = await this.prisma.certificado.findMany({
      where: {
        unidadeId: profissional.unidadeId,
        ...(filtros.cursoId
          ? { matricula: { turma: { cursoId: filtros.cursoId } } }
          : {}),
        ...(emitidoEm ? { emitidoEm } : {}),
        ...buscaTexto,
      },
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
      metadados: {
        contexto: "listagem",
        total: items.length,
        filtros: {
          q: termo ?? null,
          cursoId: filtros.cursoId ?? null,
          periodo: emitidoEm ? { de: filtros.de ?? null, ate: filtros.ate ?? null } : null,
        },
      },
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

  /**
   * Monta o filtro Prisma de intervalo de data (`{ gte, lte }`) a partir de
   * `de`/`ate` em ISO (YYYY-MM-DD). Datas inválidas são ignoradas; `ate` inclui
   * o dia inteiro (vai até 23:59:59.999). Retorna undefined se nada válido.
   */
  private intervaloData(
    de?: string,
    ate?: string,
  ): { gte?: Date; lte?: Date } | undefined {
    const filtro: { gte?: Date; lte?: Date } = {};
    if (de) {
      const d = new Date(`${de}T00:00:00`);
      if (!Number.isNaN(d.getTime())) filtro.gte = d;
    }
    if (ate) {
      const a = new Date(`${ate}T23:59:59.999`);
      if (!Number.isNaN(a.getTime())) filtro.lte = a;
    }
    return filtro.gte || filtro.lte ? filtro : undefined;
  }

  /**
   * Matrículas consolidadas da unidade (visão de semestre), agrupadas por turma.
   * Hoje a lista de alunos só existe dentro do detalhe de uma turma — esta visão
   * cruza todas as turmas para acompanhar quem está matriculado no período.
   * Filtros opcionais (A3, read-only — só estreitam dentro da própria unidade):
   *  - `status`: situação da matrícula (ATIVA, LISTA_ESPERA...).
   *  - `q`: busca por nome do aluno (titular/dependente) ou protocolo da ficha.
   *  - `cursoId`: só matrículas em turmas daquele curso.
   * Leitura de dado pessoal → LGPD.
   */
  async matriculasSemestre(
    user: AuthenticatedUser,
    status?: StatusMatricula,
    filtros: { q?: string; cursoId?: string } = {},
  ) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const unidadeId = profissional.unidadeId;

    const termo = filtros.q?.trim();
    // Busca textual (insensível a caixa) cobre aluno titular, dependente e protocolo.
    const buscaTexto = termo
      ? {
          OR: [
            { ficha: { nomeCompleto: { contains: termo, mode: "insensitive" as const } } },
            { ficha: { protocolo: { contains: termo, mode: "insensitive" as const } } },
            { membro: { nomeCompleto: { contains: termo, mode: "insensitive" as const } } },
          ],
        }
      : {};

    const matriculas = await this.prisma.matricula.findMany({
      where: {
        unidadeId,
        ...(status ? { status } : {}),
        ...(filtros.cursoId ? { turma: { cursoId: filtros.cursoId } } : {}),
        ...buscaTexto,
      },
      orderBy: [{ turma: { codigo: "asc" } }, { criadoEm: "asc" }],
      select: {
        id: true,
        status: true,
        posicaoEspera: true,
        criadoEm: true,
        ficha: { select: { id: true, protocolo: true, nomeCompleto: true } },
        membro: { select: { id: true, nomeCompleto: true } },
        turma: {
          select: {
            id: true,
            codigo: true,
            status: true,
            curso: { select: { id: true, nome: true } },
          },
        },
        certificado: { select: { codigoVerificacao: true } },
      },
    });

    // Agrupa por turma para a tela renderizar blocos (turma → alunos).
    const porTurmaMap = new Map<
      string,
      {
        turmaId: string;
        codigo: string;
        statusTurma: StatusTurma;
        curso: string;
        alunos: {
          id: string;
          aluno: string;
          protocolo: string;
          status: StatusMatricula;
          posicaoEspera: number | null;
          certificado: string | null;
        }[];
      }
    >();

    const totaisPorStatus: Record<string, number> = {};
    for (const m of matriculas) {
      totaisPorStatus[m.status] = (totaisPorStatus[m.status] ?? 0) + 1;
      const chave = m.turma.id;
      if (!porTurmaMap.has(chave)) {
        porTurmaMap.set(chave, {
          turmaId: m.turma.id,
          codigo: m.turma.codigo,
          statusTurma: m.turma.status,
          curso: m.turma.curso.nome,
          alunos: [],
        });
      }
      porTurmaMap.get(chave)!.alunos.push({
        id: m.id,
        aluno: m.membro?.nomeCompleto ?? m.ficha.nomeCompleto,
        protocolo: m.ficha.protocolo,
        status: m.status,
        posicaoEspera: m.posicaoEspera,
        certificado: m.certificado?.codigoVerificacao ?? null,
      });
    }

    // Lista de alunos consolidada é dado pessoal — entra na trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "Matricula",
      metadados: {
        contexto: "matriculasSemestre",
        total: matriculas.length,
        filtroStatus: status ?? "todos",
        q: termo ?? null,
        cursoId: filtros.cursoId ?? null,
      },
    });

    return {
      total: matriculas.length,
      totaisPorStatus,
      turmas: Array.from(porTurmaMap.values()),
    };
  }

  /** Indicadores da unidade: turmas/matrículas por status, certificados, conclusão. */
  async indicadores(user: AuthenticatedUser) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const unidadeId = prof.unidadeId;

    const [turmasG, matriculasG, certificados, cursosAtivos] = await Promise.all([
      this.prisma.turma.groupBy({
        by: ["status"],
        where: { unidadeId },
        _count: { _all: true },
        orderBy: { status: "asc" },
      }),
      this.prisma.matricula.groupBy({
        by: ["status"],
        where: { unidadeId },
        _count: { _all: true },
        orderBy: { status: "asc" },
      }),
      this.prisma.certificado.count({ where: { unidadeId } }),
      this.prisma.curso.count({ where: { unidadeId, ativo: true } }),
    ]);

    const turmas: Record<string, number> = {};
    for (const g of turmasG) turmas[g.status] = g._count._all;
    const matriculas: Record<string, number> = {};
    for (const g of matriculasG) matriculas[g.status] = g._count._all;

    const concluidas = matriculas.CONCLUIDA ?? 0;
    const evadidas = matriculas.EVADIDA ?? 0;
    const taxaConclusao =
      concluidas + evadidas > 0
        ? Math.round((concluidas / (concluidas + evadidas)) * 100)
        : null;

    return { turmas, matriculas, certificados, cursosAtivos, taxaConclusao };
  }

  // ============================================================
  // Indicadores LONGITUDINAIS — séries temporais por mês (A2)
  // ============================================================
  /**
   * Visão longitudinal da Capacitação DA UNIDADE: para cada um dos últimos N
   * meses, conta matrículas novas, conclusões, certificados emitidos e evasões.
   * generate_series garante a grade de N meses (meses sem dado = 0) para o
   * gráfico não "pular" buracos. Só agregação READ sobre o que o banco já tem;
   * sem IA, sem schema novo. Espelha o padrão de `presidencia.impactoSeries`,
   * mas FILTRADO POR UNIDADE (tenant): `unidadeId` vem de resolverPorUser e é
   * PARAMETRIZADO ($queryRaw) — nunca concatenado → sem SQLi. `meses` é um
   * inteiro saneado por normalizarMeses (3 a 24).
   */
  async indicadoresSeries(user: AuthenticatedUser, mesesBruto?: string | number) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const unidadeId = prof.unidadeId;

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "CapacitacaoIndicadoresSeries",
      entidadeId: unidadeId,
    });

    const meses = this.normalizarMeses(mesesBruto);
    const offset = meses - 1;

    // Matrículas novas no mês (criadoEm) — todos os status, pois conta a entrada.
    const serieMatriculas = await this.serieMensalMatricula(unidadeId, offset, {
      colunaData: "criadoEm",
    });
    // Conclusões: matrícula que chegou a CONCLUIDA. Sem coluna de "concluído em",
    // usamos atualizadoEm (instante da última mudança de estado da matrícula).
    const serieConclusoes = await this.serieMensalMatricula(unidadeId, offset, {
      colunaData: "atualizadoEm",
      status: StatusMatricula.CONCLUIDA,
    });
    // Evasões: idem, status EVADIDA pelo atualizadoEm.
    const serieEvasoes = await this.serieMensalMatricula(unidadeId, offset, {
      colunaData: "atualizadoEm",
      status: StatusMatricula.EVADIDA,
    });
    // Certificados emitidos no mês (emitidoEm) — tabela própria.
    const serieCertificados = await this.serieMensalCertificado(unidadeId, offset);

    const somar = (s: { total: number }[]) => s.reduce((a, p) => a + p.total, 0);
    const totalConclusoes = somar(serieConclusoes);
    const totalEvasoes = somar(serieEvasoes);
    // Taxa de conclusão do período: concluídas sobre concluídas + evadidas.
    const taxaConclusao =
      totalConclusoes + totalEvasoes > 0
        ? Math.round((totalConclusoes / (totalConclusoes + totalEvasoes)) * 100)
        : null;

    return {
      meses,
      kpis: {
        matriculas: somar(serieMatriculas),
        conclusoes: totalConclusoes,
        certificados: somar(serieCertificados),
        evasoes: totalEvasoes,
        taxaConclusao,
      },
      series: [
        { chave: "matriculas", label: "Matrículas", pontos: serieMatriculas },
        { chave: "conclusoes", label: "Conclusões", pontos: serieConclusoes },
        { chave: "certificados", label: "Certificados", pontos: serieCertificados },
        { chave: "evasoes", label: "Evasões", pontos: serieEvasoes },
      ],
    };
  }

  /** Saneia o nº de meses pedido: inteiro entre 3 e 24 (default 12). */
  private normalizarMeses(bruto?: string | number): number {
    const n = typeof bruto === "string" ? Number.parseInt(bruto, 10) : bruto;
    if (n == null || Number.isNaN(n)) return 12;
    return Math.min(24, Math.max(3, Math.trunc(n)));
  }

  /**
   * Série mensal de matrículas da unidade. `unidadeId` é PARAMETRIZADO; `offset`
   * é inteiro saneado; `colunaData`/`status` vêm SÓ de literais internos deste
   * service (enum Prisma / nomes de coluna fixos) → sem entrada externa
   * interpolada, sem SQLi. generate_series preenche meses vazios com zero.
   */
  private serieMensalMatricula(
    unidadeId: string,
    offset: number,
    opts: { colunaData: "criadoEm" | "atualizadoEm"; status?: StatusMatricula },
  ) {
    // offset é inteiro saneado (Math.trunc no normalizarMeses) → seguro como
    // literal em make_interval (evita ambiguidade de tipo do bind do Prisma).
    const offsetSeguro = Math.trunc(offset);
    const coluna = Prisma.raw(`"${opts.colunaData}"`);
    const grade = Prisma.raw(`make_interval(months => ${offsetSeguro})`);
    const filtroStatus = opts.status
      ? Prisma.sql`AND t.status = ${opts.status}::"StatusMatricula"`
      : Prisma.empty;
    return this.prisma.$queryRaw<{ mes: string; total: number }[]>`
      SELECT to_char(m.mes, 'YYYY-MM') AS mes, count(t.id)::int AS total
      FROM generate_series(
        date_trunc('month', now()) - ${grade},
        date_trunc('month', now()),
        interval '1 month'
      ) AS m(mes)
      LEFT JOIN matriculas t
        ON date_trunc('month', t.${coluna}) = m.mes
        AND t."unidadeId" = ${unidadeId}
        ${filtroStatus}
      GROUP BY m.mes ORDER BY m.mes
    `;
  }

  /** Série mensal de certificados emitidos (emitidoEm) na unidade. */
  private serieMensalCertificado(unidadeId: string, offset: number) {
    const grade = Prisma.raw(`make_interval(months => ${Math.trunc(offset)})`);
    return this.prisma.$queryRaw<{ mes: string; total: number }[]>`
      SELECT to_char(m.mes, 'YYYY-MM') AS mes, count(t.id)::int AS total
      FROM generate_series(
        date_trunc('month', now()) - ${grade},
        date_trunc('month', now()),
        interval '1 month'
      ) AS m(mes)
      LEFT JOIN certificados t
        ON date_trunc('month', t."emitidoEm") = m.mes
        AND t."unidadeId" = ${unidadeId}
      GROUP BY m.mes ORDER BY m.mes
    `;
  }
}
