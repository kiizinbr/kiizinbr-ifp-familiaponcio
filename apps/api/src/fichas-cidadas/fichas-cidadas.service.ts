import { randomBytes } from "node:crypto";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AcaoAuditoria, Prisma } from "@ifp/database";

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

    const { dataNascimento, ...rest } = dto;
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
      metadados: { campos: Object.keys(dto) },
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

    const elegibilidade = await this.prisma.elegibilidadePorUnidade.upsert({
      where: { fichaId_unidadeId: { fichaId, unidadeId: unidade.id } },
      create: {
        fichaId,
        unidadeId: unidade.id,
        status: dto.status,
        motivo: dto.motivo,
        reavaliarEm: dto.reavaliarEm ? new Date(dto.reavaliarEm) : null,
        avaliadoPor: autorId,
        avaliadoEm: new Date(),
      },
      update: {
        status: dto.status,
        motivo: dto.motivo,
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
      },
    });

    return elegibilidade;
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.fichaCidada.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Ficha não encontrada");
  }
}
