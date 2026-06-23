import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AcaoAuditoria, Perfil, Prisma, StatusElegibilidade } from "@ifp/database";
import { hash } from "bcrypt";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateFichaCidadaDto } from "./dto/create-ficha-cidada.dto";
import type { ListFichasQuery } from "./dto/list-fichas.query";
import type { MembroFamiliarDto, ReplaceMembrosDto } from "./dto/replace-membros.dto";
import type { UpdateElegibilidadeDto } from "./dto/update-elegibilidade.dto";
import type { UpdateFichaCidadaDto } from "./dto/update-ficha-cidada.dto";
import type { UpsertDadosSocioDto } from "./dto/upsert-dados-socio.dto";

const fichaInclude = {
  membros: true,
  dadosSocio: true,
  documentos: true,
  entrevistas: true,
  consentimentos: true,
  elegibilidades: { include: { unidade: true } },
} satisfies Prisma.FichaCidadaInclude;

/** Alfabeto sem caracteres ambíguos (0/O, 1/l/I) — espelha o de UsersService. */
const ALFABETO_SENHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

@Injectable()
export class FichasCidadasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** "IFP-2025-3F9A2B" — ano corrente + 6 hex chars (sem colisão em qualquer volume realista). */
  private gerarProtocolo() {
    const ano = new Date().getFullYear();
    const sufixo = randomBytes(3).toString("hex").toUpperCase();
    return `IFP-${ano}-${sufixo}`;
  }

  async create(dto: CreateFichaCidadaDto, autorId: string) {
    const existente = await this.prisma.fichaCidada.findUnique({ where: { cpf: dto.cpf } });
    if (existente) {
      throw new ConflictException(`Já existe Ficha Cidadã para o CPF ${dto.cpf}.`);
    }

    const ficha = await this.prisma.fichaCidada.create({
      data: {
        protocolo: this.gerarProtocolo(),
        nomeCompleto: dto.nomeCompleto,
        cpf: dto.cpf,
        rg: dto.rg,
        dataNascimento: new Date(dto.dataNascimento),
        estadoCivil: dto.estadoCivil,
        escolaridade: dto.escolaridade,
        fotoUrl: dto.fotoUrl,
        telefone: dto.telefone,
        telefoneAlt: dto.telefoneAlt,
        email: dto.email,
        whatsappOptIn: dto.whatsappOptIn ?? false,
        cep: dto.cep,
        logradouro: dto.logradouro,
        numero: dto.numero,
        complemento: dto.complemento,
        bairro: dto.bairro,
        cidade: dto.cidade ?? "Duque de Caxias",
        uf: dto.uf ?? "RJ",
        observacoes: dto.observacoes,
      },
      include: fichaInclude,
    });

    this.audit.registrar({
      userId: autorId,
      acao: AcaoAuditoria.CREATE,
      entidade: "FichaCidada",
      entidadeId: ficha.id,
      metadados: { protocolo: ficha.protocolo },
    });

    return ficha;
  }

  async findOne(id: string, leitorId: string) {
    const ficha = await this.prisma.fichaCidada.findUnique({
      where: { id },
      include: fichaInclude,
    });
    if (!ficha) throw new NotFoundException("Ficha não encontrada");

    this.audit.registrar({
      userId: leitorId,
      acao: AcaoAuditoria.READ,
      entidade: "FichaCidada",
      entidadeId: ficha.id,
    });

    return ficha;
  }

  async findAll(query: ListFichasQuery, leitorId: string) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const filters: Prisma.FichaCidadaWhereInput[] = [];

    if (query.ativa !== undefined) {
      filters.push({ ativa: query.ativa });
    }

    if (query.q) {
      const termo = query.q.trim();
      const digitos = termo.replace(/\D/g, "");
      const orFilters: Prisma.FichaCidadaWhereInput[] = [
        { nomeCompleto: { contains: termo, mode: "insensitive" } },
        { protocolo: { contains: termo.toUpperCase() } },
      ];
      if (digitos.length >= 3) {
        orFilters.push({ cpf: { contains: digitos } });
      }
      filters.push({ OR: orFilters });
    }

    if (query.status || query.unidade) {
      filters.push({
        elegibilidades: {
          some: {
            ...(query.status ? { status: query.status } : {}),
            ...(query.unidade ? { unidade: { slug: query.unidade } } : {}),
          },
        },
      });
    }

    const where: Prisma.FichaCidadaWhereInput = filters.length ? { AND: filters } : {};

    const [total, items] = await this.prisma.$transaction([
      this.prisma.fichaCidada.count({ where }),
      this.prisma.fichaCidada.findMany({
        where,
        orderBy: { criadoEm: "desc" },
        skip,
        take: perPage,
        include: {
          elegibilidades: { include: { unidade: true } },
        },
      }),
    ]);

    // Lista da base de famílias = PII em massa (CPF, renda, vulnerabilidade).
    // Quem consultou tem de ficar na trilha LGPD, igual ao detalhe (findOne).
    this.audit.registrar({
      userId: leitorId,
      acao: AcaoAuditoria.READ,
      entidade: "FichaCidada.lista",
      metadados: {
        q: query.q ?? null,
        status: query.status ?? null,
        unidade: query.unidade ?? null,
        ativa: query.ativa ?? null,
        page,
        total,
      },
    });

    return {
      items,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async update(id: string, dto: UpdateFichaCidadaDto, autorId: string) {
    await this.assertExists(id);

    // Protocolo e CPF são a identidade da família: imutáveis na edição. O DTO
    // herda `cpf` do create (PartialType), então descartamos aqui para que um
    // PATCH não consiga trocar o CPF (e o protocolo nem é editável pelo DTO).
    const { dataNascimento, cpf: _cpfIgnorado, ...rest } = dto;
    const ficha = await this.prisma.fichaCidada.update({
      where: { id },
      data: {
        ...rest,
        ...(dataNascimento ? { dataNascimento: new Date(dataNascimento) } : {}),
      },
      include: fichaInclude,
    });

    this.audit.registrar({
      userId: autorId,
      acao: AcaoAuditoria.UPDATE,
      entidade: "FichaCidada",
      entidadeId: id,
      // CPF nunca é alterado; não entra na trilha de campos editados.
      metadados: { campos: Object.keys(rest).concat(dataNascimento ? ["dataNascimento"] : []) },
    });

    return ficha;
  }

  /**
   * Reconcilia a composição familiar SEM apagar quem já existe. O `deleteMany`
   * + `createMany` anterior gerava novos ids a cada salvar: membros com
   * relação `SetNull` (atendimentos, alergias) ficavam com prontuário órfão, e
   * membros com relação `Restrict` (matrícula infantil, check-in, diário,
   * autorizados, conversa) faziam a transação estourar 500. Aqui casamos por
   * identidade natural (CPF; ou nome+nascimento p/ menores sem CPF), atualizamos
   * quem permanece, criamos os novos e só removemos quem NÃO tem histórico.
   * O DTO não traz `id` — daí o casamento por chave natural.
   */
  async replaceMembros(id: string, dto: ReplaceMembrosDto, autorId: string) {
    await this.assertExists(id);

    const existentes = await this.prisma.membroFamiliar.findMany({
      where: { fichaId: id },
      select: {
        id: true,
        cpf: true,
        nomeCompleto: true,
        dataNascimento: true,
        conversa: { select: { id: true } },
        _count: {
          select: {
            agendamentos: true,
            atendimentos: true,
            alergias: true,
            condicoesCronicas: true,
            matriculas: true,
            autorizacoesImagem: true,
            matriculasInfantis: true,
            responsaveisAutorizados: true,
            checksInOut: true,
            diariosDia: true,
            matriculasEsportivas: true,
            prescricoes: true,
          },
        },
      },
    });

    const porChave = new Map(
      existentes.map((m) => [this.chaveMembro(m.cpf, m.nomeCompleto, m.dataNascimento), m]),
    );

    const aAtualizar: Array<{ id: string; dados: ReturnType<FichasCidadasService["dadosMembro"]> }> =
      [];
    const aCriar: MembroFamiliarDto[] = [];
    const casados = new Set<string>();

    for (const m of dto.membros) {
      const chave = this.chaveMembro(m.cpf, m.nomeCompleto, m.dataNascimento);
      const existente = porChave.get(chave);
      if (existente && !casados.has(existente.id)) {
        casados.add(existente.id);
        aAtualizar.push({ id: existente.id, dados: this.dadosMembro(m) });
      } else {
        aCriar.push(m);
      }
    }

    const aRemover = existentes.filter((m) => !casados.has(m.id));
    const comHistorico = aRemover.filter(
      (m) => m.conversa !== null || Object.values(m._count).some((n) => n > 0),
    );
    if (comHistorico.length) {
      throw new ConflictException(
        `Não é possível remover da composição familiar quem já tem histórico no instituto: ` +
          `${comHistorico.map((m) => m.nomeCompleto).join(", ")}. ` +
          `Edite os dados da pessoa em vez de removê-la.`,
      );
    }

    const ficha = await this.prisma.$transaction(async (tx) => {
      for (const u of aAtualizar) {
        await tx.membroFamiliar.update({ where: { id: u.id }, data: u.dados });
      }
      if (aCriar.length) {
        await tx.membroFamiliar.createMany({
          data: aCriar.map((m) => ({ fichaId: id, ...this.dadosMembro(m) })),
        });
      }
      if (aRemover.length) {
        await tx.membroFamiliar.deleteMany({
          where: { id: { in: aRemover.map((m) => m.id) } },
        });
      }
      return tx.fichaCidada.findUniqueOrThrow({ where: { id }, include: fichaInclude });
    });

    this.audit.registrar({
      userId: autorId,
      acao: AcaoAuditoria.UPDATE,
      entidade: "FichaCidada.membros",
      entidadeId: id,
      metadados: {
        total: dto.membros.length,
        criados: aCriar.length,
        atualizados: aAtualizar.length,
        removidos: aRemover.length,
      },
    });

    return ficha;
  }

  /** Identidade natural de um membro: CPF (forte) ou nome+nascimento (menores sem CPF). */
  private chaveMembro(cpf: string | null | undefined, nome: string, nasc: string | Date): string {
    const digitos = cpf?.replace(/\D/g, "");
    if (digitos && digitos.length === 11) return `cpf:${digitos}`;
    const data = typeof nasc === "string" ? new Date(nasc) : nasc;
    const ymd = data.toISOString().slice(0, 10);
    return `nn:${nome.trim().toLowerCase().replace(/\s+/g, " ")}|${ymd}`;
  }

  /** Campos graváveis de um membro a partir do DTO (compartilhado por create/update). */
  private dadosMembro(m: MembroFamiliarDto) {
    return {
      nomeCompleto: m.nomeCompleto,
      cpf: m.cpf,
      dataNascimento: new Date(m.dataNascimento),
      parentesco: m.parentesco,
      ocupacao: m.ocupacao,
      escolaridade: m.escolaridade,
      rendaMensal: m.rendaMensal !== undefined ? new Prisma.Decimal(m.rendaMensal) : null,
      observacoes: m.observacoes,
    };
  }

  async upsertDadosSocio(id: string, dto: UpsertDadosSocioDto, autorId: string) {
    await this.assertExists(id);

    await this.prisma.dadosSocioeconomicos.upsert({
      where: { fichaId: id },
      create: {
        fichaId: id,
        rendaFamiliarTotal: new Prisma.Decimal(dto.rendaFamiliarTotal),
        rendaPerCapita: new Prisma.Decimal(dto.rendaPerCapita),
        recebeBolsaFamilia: dto.recebeBolsaFamilia ?? false,
        recebeBPC: dto.recebeBPC ?? false,
        recebeAuxilioGas: dto.recebeAuxilioGas ?? false,
        outrosBeneficios: dto.outrosBeneficios,
        situacaoMoradia: dto.situacaoMoradia,
        numeroPessoasMoradia: dto.numeroPessoasMoradia,
        numeroComodos: dto.numeroComodos,
        temAguaEncanada: dto.temAguaEncanada ?? true,
        temEsgoto: dto.temEsgoto ?? true,
        temEnergiaEletrica: dto.temEnergiaEletrica ?? true,
        vulnerabilidades: dto.vulnerabilidades,
      },
      update: {
        rendaFamiliarTotal: new Prisma.Decimal(dto.rendaFamiliarTotal),
        rendaPerCapita: new Prisma.Decimal(dto.rendaPerCapita),
        recebeBolsaFamilia: dto.recebeBolsaFamilia ?? false,
        recebeBPC: dto.recebeBPC ?? false,
        recebeAuxilioGas: dto.recebeAuxilioGas ?? false,
        outrosBeneficios: dto.outrosBeneficios,
        situacaoMoradia: dto.situacaoMoradia,
        numeroPessoasMoradia: dto.numeroPessoasMoradia,
        numeroComodos: dto.numeroComodos,
        temAguaEncanada: dto.temAguaEncanada ?? true,
        temEsgoto: dto.temEsgoto ?? true,
        temEnergiaEletrica: dto.temEnergiaEletrica ?? true,
        vulnerabilidades: dto.vulnerabilidades,
      },
    });

    this.audit.registrar({
      userId: autorId,
      acao: AcaoAuditoria.UPDATE,
      entidade: "FichaCidada.dadosSocio",
      entidadeId: id,
    });

    return this.prisma.fichaCidada.findUniqueOrThrow({
      where: { id },
      include: fichaInclude,
    });
  }

  async updateElegibilidade(
    fichaId: string,
    unidadeSlug: string,
    dto: UpdateElegibilidadeDto,
    autorId: string,
  ) {
    const [ficha, unidade] = await Promise.all([
      this.prisma.fichaCidada.findUnique({ where: { id: fichaId } }),
      this.prisma.unidade.findUnique({ where: { slug: unidadeSlug } }),
    ]);
    if (!ficha) throw new NotFoundException("Ficha não encontrada");
    if (!unidade) throw new NotFoundException(`Unidade '${unidadeSlug}' não encontrada`);

    // LGPD: reprovar/suspender/desligar exige justificativa registrada — a ação
    // mais sensível não pode entrar na trilha sem o porquê. A tela valida no
    // client, mas o backend é a fonte de verdade (senão a regra é burlável).
    const EXIGEM_MOTIVO: StatusElegibilidade[] = [
      StatusElegibilidade.REPROVADO,
      StatusElegibilidade.SUSPENSO,
      StatusElegibilidade.DESLIGADO,
    ];
    const motivo = dto.motivo?.trim() || null;
    if (EXIGEM_MOTIVO.includes(dto.status) && (!motivo || motivo.length < 3)) {
      throw new BadRequestException(
        "Informe o motivo (mín. 3 caracteres) ao reprovar, suspender ou desligar a elegibilidade.",
      );
    }

    const elegibilidade = await this.prisma.elegibilidadePorUnidade.upsert({
      where: { fichaId_unidadeId: { fichaId, unidadeId: unidade.id } },
      create: {
        fichaId,
        unidadeId: unidade.id,
        status: dto.status,
        motivo,
        reavaliarEm: dto.reavaliarEm ? new Date(dto.reavaliarEm) : null,
        avaliadoPor: autorId,
        avaliadoEm: new Date(),
      },
      update: {
        status: dto.status,
        motivo,
        reavaliarEm: dto.reavaliarEm ? new Date(dto.reavaliarEm) : null,
        avaliadoPor: autorId,
        avaliadoEm: new Date(),
      },
      include: { unidade: true },
    });

    this.audit.registrar({
      userId: autorId,
      acao: AcaoAuditoria.UPDATE,
      entidade: "ElegibilidadePorUnidade",
      entidadeId: elegibilidade.id,
      metadados: {
        fichaId,
        unidade: unidade.slug,
        status: dto.status,
        ...(motivo ? { motivo } : {}),
      },
    });

    return elegibilidade;
  }

  // ------------------------------------------------------------
  // Acesso da família (auto-provisionamento) — reusa o fluxo de 1º acesso
  // ------------------------------------------------------------

  /** Senha provisória legível, mostrada uma única vez na tela do operador. */
  private gerarSenhaProvisoria(tamanho = 12): string {
    const bytes = randomBytes(tamanho);
    let senha = "";
    for (const byte of bytes) {
      senha += ALFABETO_SENHA[byte % ALFABETO_SENHA.length] ?? "";
    }
    return senha;
  }

  /**
   * E-mail de login do responsável. Usa o e-mail da ficha quando há; senão
   * deriva um identificador estável do protocolo (o sistema NÃO envia e-mail —
   * o login é por essa string e a senha provisória aparece na tela do operador).
   */
  private emailAcesso(ficha: { email: string | null; protocolo: string }): string {
    const informado = ficha.email?.trim().toLowerCase();
    if (informado) return informado;
    const slug = ficha.protocolo.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `familia.${slug}@ifp.local`;
  }

  /** Resumo do acesso (sem nunca expor o hash da senha) para a tela. */
  private resumoAcesso(user: {
    id: string;
    nome: string;
    email: string;
    ativo: boolean;
    mustChangePassword: boolean;
    ultimoLogin: Date | null;
    criadoEm: Date;
  }) {
    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      ativo: user.ativo,
      mustChangePassword: user.mustChangePassword,
      ultimoLogin: user.ultimoLogin,
      criadoEm: user.criadoEm,
    };
  }

  /**
   * Estado atual do acesso do responsável da ficha (existe? já trocou a senha?).
   * READ de dado pessoal — entra na trilha LGPD.
   */
  async obterAcessoFamilia(fichaId: string, leitorId: string) {
    const ficha = await this.prisma.fichaCidada.findUnique({
      where: { id: fichaId },
      select: { id: true, protocolo: true, nomeCompleto: true },
    });
    if (!ficha) throw new NotFoundException("Ficha não encontrada");

    const user = await this.prisma.user.findUnique({
      where: { fichaCidadaId: fichaId },
      select: {
        id: true,
        nome: true,
        email: true,
        ativo: true,
        mustChangePassword: true,
        ultimoLogin: true,
        criadoEm: true,
      },
    });

    this.audit.registrar({
      userId: leitorId,
      acao: AcaoAuditoria.READ,
      entidade: "FichaCidada.acessoFamilia",
      entidadeId: fichaId,
      metadados: { possuiAcesso: Boolean(user) },
    });

    return {
      possuiAcesso: Boolean(user),
      acesso: user ? this.resumoAcesso(user) : null,
    };
  }

  /**
   * Auto-provisiona o acesso do responsável da família: cria um User
   * RESPONSAVEL_FAMILIAR vinculado à ficha (User.fichaCidadaId) com senha
   * PROVISÓRIA e mustChangePassword=true — reusando o MESMO mecanismo de 1º
   * acesso da gestão de usuários. A senha só existe nesta resposta (nunca
   * persiste em claro) e o sistema NÃO envia e-mail.
   *
   * Idempotente: se a ficha já tem acesso, devolve o estado atual SEM gerar nova
   * senha (`jaExistia: true`). Para reemitir a senha use o reset na gestão de
   * usuários (fluxo já existente) — aqui não reciclamos credencial em silêncio.
   */
  async gerarAcessoFamilia(fichaId: string, atorId: string) {
    const ficha = await this.prisma.fichaCidada.findUnique({
      where: { id: fichaId },
      select: { id: true, protocolo: true, nomeCompleto: true, email: true },
    });
    if (!ficha) throw new NotFoundException("Ficha não encontrada");

    // Idempotência: 1 acesso por ficha (User.fichaCidadaId é @unique).
    const existente = await this.prisma.user.findUnique({
      where: { fichaCidadaId: fichaId },
      select: {
        id: true,
        nome: true,
        email: true,
        ativo: true,
        mustChangePassword: true,
        ultimoLogin: true,
        criadoEm: true,
      },
    });
    if (existente) {
      this.audit.registrar({
        userId: atorId,
        acao: AcaoAuditoria.READ,
        entidade: "FichaCidada.acessoFamilia",
        entidadeId: fichaId,
        metadados: { evento: "acesso-ja-existe", userId: existente.id },
      });
      return {
        jaExistia: true,
        senhaProvisoria: null,
        acesso: this.resumoAcesso(existente),
      };
    }

    const email = this.emailAcesso(ficha);
    // O e-mail é a chave de login (@unique em User). Se já estiver em uso por
    // OUTRA conta (ex.: a ficha reaproveita um e-mail de funcionário), não dá
    // para criar o acesso — orienta a corrigir o e-mail da ficha.
    const emailEmUso = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (emailEmUso) {
      throw new ConflictException(
        `O e-mail ${email} já pertence a outra conta. Ajuste o e-mail da ficha antes de gerar o acesso da família.`,
      );
    }

    const senhaProvisoria = this.gerarSenhaProvisoria();
    const senhaHash = await hash(senhaProvisoria, 12);

    const user = await this.prisma
      .$transaction(async (tx) => {
        const criado = await tx.user.create({
          data: {
            nome: ficha.nomeCompleto,
            email,
            senhaHash,
            mustChangePassword: true,
            ativo: true,
            fichaCidadaId: ficha.id,
          },
        });
        await tx.usuarioPerfil.create({
          data: { userId: criado.id, perfil: Perfil.RESPONSAVEL_FAMILIAR },
        });
        return criado;
      })
      .catch((e: unknown) => {
        // Corrida entre o pré-check e o INSERT (e-mail/ficha @unique): traduz o
        // P2002 para 409 em vez de deixar escapar como 500.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new ConflictException(
            "Já existe um acesso vinculado a esta ficha ou a este e-mail.",
          );
        }
        throw e;
      });

    this.audit.registrar({
      userId: atorId,
      acao: AcaoAuditoria.CREATE,
      entidade: "User",
      entidadeId: user.id,
      metadados: {
        evento: "auto-provisionamento-acesso-familia",
        fichaId: ficha.id,
        protocolo: ficha.protocolo,
        perfil: Perfil.RESPONSAVEL_FAMILIAR,
      },
    });

    // A senha provisória só existe aqui (nunca persiste em claro nem em log).
    return {
      jaExistia: false,
      senhaProvisoria,
      acesso: this.resumoAcesso(user),
    };
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.fichaCidada.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Ficha não encontrada");
  }
}
