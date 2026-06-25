import { Injectable } from "@nestjs/common";
import {
  AcaoAuditoria,
  StatusAgendamento,
  StatusElegibilidade,
  StatusMatricula,
  StatusTurma,
  TipoUnidade,
} from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";

/**
 * Sala de Comando da Presidência: agregações CROSS-UNIDADE, sempre anônimas
 * (a presidência vê contagens, nunca a ficha individual). Toda leitura entra
 * na trilha LGPD via AuditService. As consultas leem só o que o banco já tem
 * de verdade — KPIs sem fonte de dado (custo, doadores) ficam fora.
 */
@Injectable()
export class PresidenciaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Trilha LGPD: a presidência leu um recorte agregado. */
  private auditarLeitura(user: AuthenticatedUser, secao: string) {
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "PresidenciaDashboard",
      entidadeId: secao,
    });
  }

  /** Primeiro dia do mês corrente (para "novas no mês"/"atendimentos no mês"). */
  private inicioDoMes(): Date {
    const agora = new Date();
    return new Date(agora.getFullYear(), agora.getMonth(), 1);
  }

  // ============================================================
  // Painel (home) — KPIs de volume cruzando todas as unidades
  // ============================================================
  async resumo(user: AuthenticatedUser) {
    this.auditarLeitura(user, "resumo");
    const inicioMes = this.inicioDoMes();

    const [
      familiasAtivas,
      familiasAtendidas,
      totalMembros,
      novasFichasMes,
      atendimentosMes,
      matriculasCapacitacao,
      matriculasEducacional,
      matriculasEsportivas,
      certificados,
      graduacoes,
      unidadesAtivas,
      profissionaisAtivos,
    ] = await this.prisma.$transaction([
      this.prisma.fichaCidada.count({ where: { ativa: true } }),
      this.prisma.fichaCidada.count({
        where: { ativa: true, elegibilidades: { some: { status: StatusElegibilidade.APROVADO } } },
      }),
      this.prisma.membroFamiliar.count({ where: { ficha: { ativa: true } } }),
      this.prisma.fichaCidada.count({ where: { ativa: true, criadoEm: { gte: inicioMes } } }),
      this.prisma.atendimento.count({ where: { encerradoEm: { gte: inicioMes } } }),
      this.prisma.matricula.count({ where: { status: StatusMatricula.ATIVA } }),
      this.prisma.matriculaInfantil.count({ where: { ativa: true } }),
      this.prisma.matriculaEsportiva.count({ where: { status: StatusMatricula.ATIVA } }),
      this.prisma.certificado.count(),
      this.prisma.graduacao.count(),
      this.prisma.unidade.count({ where: { ativo: true } }),
      this.prisma.profissional.count({ where: { ativo: true } }),
    ]);

    return {
      familiasAtivas,
      familiasAtendidas,
      // pessoas impactadas = titulares (fichas ativas) + demais membros do lar
      pessoasImpactadas: familiasAtivas + totalMembros,
      novasFichasMes,
      atendimentosMes,
      matriculasAtivas:
        matriculasCapacitacao + matriculasEducacional + matriculasEsportivas,
      certificados,
      graduacoes,
      unidadesAtivas,
      profissionaisAtivos,
    };
  }

  // ============================================================
  // Famílias — retrato agregado e anônimo da base de fichas
  // ============================================================
  async familias(user: AuthenticatedUser) {
    this.auditarLeitura(user, "familias");
    const inicioMes = this.inicioDoMes();

    const [total, inativas, novasMes, totalMembros, aprovadas, comDadosSocio] =
      await this.prisma.$transaction([
        this.prisma.fichaCidada.count({ where: { ativa: true } }),
        this.prisma.fichaCidada.count({ where: { ativa: false } }),
        this.prisma.fichaCidada.count({ where: { ativa: true, criadoEm: { gte: inicioMes } } }),
        this.prisma.membroFamiliar.count({ where: { ficha: { ativa: true } } }),
        this.prisma.fichaCidada.count({
          where: {
            ativa: true,
            elegibilidades: { some: { status: StatusElegibilidade.APROVADO } },
          },
        }),
        this.prisma.dadosSocioeconomicos.count(),
      ]);

    // Distribuição por bairro (top 6 + "Outros"; bairro nulo = "Não informado")
    const bairroGrupos = await this.prisma.fichaCidada.groupBy({
      by: ["bairro"],
      where: { ativa: true },
      _count: { _all: true },
      orderBy: { _count: { bairro: "desc" } },
    });
    const porBairro = this.consolidarBairros(bairroGrupos);

    // Perfil socioeconômico (sobre as fichas que JÁ têm dados socioeconômicos)
    const [bolsaFamilia, bpc, rendaAgg] = await this.prisma.$transaction([
      this.prisma.dadosSocioeconomicos.count({ where: { recebeBolsaFamilia: true } }),
      this.prisma.dadosSocioeconomicos.count({ where: { recebeBPC: true } }),
      this.prisma.dadosSocioeconomicos.aggregate({ _avg: { rendaPerCapita: true } }),
    ]);
    // groupBy fora do $transaction: dentro dele o TS perde a tipagem de _count
    const moradiaGrupos = await this.prisma.dadosSocioeconomicos.groupBy({
      by: ["situacaoMoradia"],
      _count: { _all: true },
      orderBy: { situacaoMoradia: "asc" },
    });

    // Faixa etária de TODAS as pessoas (titulares + membros) das fichas ativas
    const faixaEtaria = await this.prisma.$queryRaw<{ faixa: string; total: number }[]>`
      SELECT faixa, count(*)::int AS total FROM (
        SELECT
          CASE
            WHEN idade <= 6 THEN '0-6'
            WHEN idade <= 17 THEN '7-17'
            WHEN idade <= 39 THEN '18-39'
            WHEN idade <= 59 THEN '40-59'
            ELSE '60+'
          END AS faixa
        FROM (
          SELECT date_part('year', age("dataNascimento"))::int AS idade
          FROM fichas_cidadas WHERE ativa = true
          UNION ALL
          SELECT date_part('year', age(m."dataNascimento"))::int AS idade
          FROM membros_familiares m
          JOIN fichas_cidadas f ON f.id = m."fichaId"
          WHERE f.ativa = true
        ) pessoas
      ) faixas
      GROUP BY faixa
    `;

    return {
      total,
      inativas,
      novasMes,
      pessoasImpactadas: total + totalMembros,
      situacao: {
        aprovadas, // ao menos uma elegibilidade APROVADA
        emTriagem: Math.max(0, total - aprovadas), // ativa, ainda sem aprovação
        inativas,
      },
      porBairro,
      perfilSocio: {
        comDados: comDadosSocio,
        rendaPerCapitaMedia:
          rendaAgg._avg.rendaPerCapita != null ? Number(rendaAgg._avg.rendaPerCapita) : null,
        recebeBolsaFamilia: bolsaFamilia,
        recebeBPC: bpc,
        moradia: moradiaGrupos.map((m) => ({
          situacao: m.situacaoMoradia,
          total: m._count._all,
        })),
      },
      faixaEtaria: this.ordenarFaixas(faixaEtaria),
    };
  }

  private consolidarBairros(
    grupos: { bairro: string | null; _count: { _all: number } }[],
  ) {
    const ordenados = grupos
      .map((g) => ({ bairro: g.bairro?.trim() || "Não informado", total: g._count._all }))
      .sort((a, b) => b.total - a.total);
    const top = ordenados.slice(0, 6);
    const resto = ordenados.slice(6).reduce((acc, b) => acc + b.total, 0);
    if (resto > 0) top.push({ bairro: "Outros", total: resto });
    return top;
  }

  // ============================================================
  // Território — panorama por BAIRRO (não é mapa geográfico)
  // ============================================================
  /**
   * Panorama territorial HONESTO: distribuição das famílias ativas pelos bairros
   * que o banco JÁ guarda (FichaCidada.bairro / FichaCidada.cidade). NÃO é mapa,
   * não tem lat/long nem heatmap — o banco não tem geolocalização. Não inventa
   * "demanda reprimida" (não há dado para isso).
   *
   * Dimensão extra REAL: cruzamento bairro × unidade via `elegibilidades`
   * (ElegibilidadePorUnidade liga ficha→unidade). É dado limpo, então CRUZAMOS.
   * Atenção à semântica: a soma de `porBairroUnidade` conta ELEGIBILIDADES
   * aprovadas (uma família em 2 unidades aparece 2x), enquanto `porBairro` conta
   * FAMÍLIAS (1x). Por isso são totais separados e rotulados de forma distinta —
   * só `porBairro` soma == `totalFamilias`.
   */
  async territorio(user: AuthenticatedUser) {
    this.auditarLeitura(user, "territorio");

    // 1) Distribuição de FAMÍLIAS ativas por bairro (reusa o consolidado top-6 +
    //    "Outros" + "Não informado"). A soma destes == totalFamilias.
    const bairroGrupos = await this.prisma.fichaCidada.groupBy({
      by: ["bairro"],
      where: { ativa: true },
      _count: { _all: true },
      orderBy: { _count: { bairro: "desc" } },
    });
    const porBairro = this.consolidarBairros(bairroGrupos);
    const totalFamilias = await this.prisma.fichaCidada.count({ where: { ativa: true } });

    // 2) Distribuição por CIDADE (campo real, default "Duque de Caxias") — outra
    //    dimensão honesta do mesmo endereço cadastrado.
    const cidadeGrupos = await this.prisma.fichaCidada.groupBy({
      by: ["cidade"],
      where: { ativa: true },
      _count: { _all: true },
      orderBy: { _count: { cidade: "desc" } },
    });
    const porCidade = cidadeGrupos
      .map((c) => ({ cidade: c.cidade?.trim() || "Não informado", total: c._count._all }))
      .sort((a, b) => b.total - a.total);

    // 3) Cruzamento bairro × unidade: contagem de ELEGIBILIDADES aprovadas por
    //    (bairro, tipo de unidade). Dado limpo da tabela `elegibilidades`. Só
    //    entram os bairros que aparecem no top de `porBairro` (os demais caem em
    //    "Outros"/"Não informado" para não estourar a tabela). count distinto de
    //    ficha por unidade para não duplicar se houvesse linhas repetidas.
    const bairrosTop = new Set(porBairro.map((b) => b.bairro));
    const cruzamentoRaw = await this.prisma.$queryRaw<
      { bairro: string | null; tipo: string; total: number }[]
    >`
      SELECT f.bairro AS bairro, u.tipo::text AS tipo,
             count(DISTINCT f.id)::int AS total
      FROM fichas_cidadas f
      JOIN elegibilidades e ON e."fichaId" = f.id
        AND e.status = 'APROVADO'::"StatusElegibilidade"
      JOIN unidades u ON u.id = e."unidadeId"
      WHERE f.ativa = true
      GROUP BY f.bairro, u.tipo
    `;

    // Reduz o cruzamento aos rótulos de bairro do top (resto → "Outros",
    // nulo/vazio → "Não informado"), somando por (rótulo, tipo de unidade).
    const acc = new Map<string, Map<string, number>>();
    for (const linha of cruzamentoRaw) {
      const nome = linha.bairro?.trim() || "Não informado";
      const rotulo = bairrosTop.has(nome) ? nome : "Outros";
      const porTipo = acc.get(rotulo) ?? new Map<string, number>();
      porTipo.set(linha.tipo, (porTipo.get(linha.tipo) ?? 0) + linha.total);
      acc.set(rotulo, porTipo);
    }
    // Mantém a MESMA ordem de `porBairro` para a UI ler alinhado.
    const porBairroUnidade = porBairro
      .map((b) => ({
        bairro: b.bairro,
        unidades: Array.from(acc.get(b.bairro)?.entries() ?? [])
          .map(([tipo, total]) => ({ tipo, total }))
          .sort((a, z) => z.total - a.total),
      }))
      .filter((linha) => linha.unidades.length > 0);

    const familiasComBairro = porBairro
      .filter((b) => b.bairro !== "Não informado")
      .reduce((soma, b) => soma + b.total, 0);

    return {
      // contexto honesto da tela (a UI usa isto no texto explicativo)
      tipo: "distribuicao-por-bairro" as const,
      totalFamilias,
      familiasComBairro,
      bairrosDistintos: bairroGrupos.length,
      porBairro,
      porCidade,
      porBairroUnidade,
    };
  }

  private ordenarFaixas(linhas: { faixa: string; total: number }[]) {
    const ordem = ["0-6", "7-17", "18-39", "40-59", "60+"];
    return ordem.map((faixa) => ({
      faixa,
      total: linhas.find((l) => l.faixa === faixa)?.total ?? 0,
    }));
  }

  // ============================================================
  // Unidades — ocupação, fila e volume de cada salão
  // ============================================================
  async unidades(user: AuthenticatedUser) {
    this.auditarLeitura(user, "unidades");

    const unidades = await this.prisma.unidade.findMany({
      where: { ativo: true },
      orderBy: { tipo: "asc" },
    });
    const porTipo = new Map(unidades.map((u) => [u.tipo, u]));

    const linhas: UnidadePulso[] = [];

    // --- Médico: sem vagas fixas → reporta VOLUME (beneficiários/agenda) ---
    const medico = porTipo.get(TipoUnidade.MEDICO);
    if (medico) {
      const inicioMes = this.inicioDoMes();
      const [beneficiarios, agendamentosAtivos, atendimentosMes] =
        await this.prisma.$transaction([
          this.prisma.elegibilidadePorUnidade.count({
            where: { unidadeId: medico.id, status: StatusElegibilidade.APROVADO },
          }),
          this.prisma.agendamento.count({
            where: {
              unidadeId: medico.id,
              status: {
                in: [
                  StatusAgendamento.AGENDADO,
                  StatusAgendamento.CONFIRMADO,
                  StatusAgendamento.EM_ATENDIMENTO,
                ],
              },
            },
          }),
          this.prisma.atendimento.count({
            where: { unidadeId: medico.id, encerradoEm: { gte: inicioMes } },
          }),
        ]);
      linhas.push({
        tipo: medico.tipo,
        nome: medico.nome,
        slug: medico.slug,
        modo: "volume",
        beneficiarios,
        agendamentosAtivos,
        atendimentosMes,
        vagas: null,
        ativos: null,
        listaEspera: null,
        ocupacaoPct: null,
      });
    }

    // --- Capacitação ---
    const capacitacao = porTipo.get(TipoUnidade.CAPACITACAO);
    if (capacitacao) {
      const [vagasAgg, ativos, espera, beneficiarios] = await this.prisma.$transaction([
        this.prisma.turma.aggregate({
          _sum: { vagasTotais: true },
          where: {
            unidadeId: capacitacao.id,
            status: { in: [StatusTurma.INSCRICOES_ABERTAS, StatusTurma.EM_ANDAMENTO] },
          },
        }),
        this.prisma.matricula.count({
          where: { unidadeId: capacitacao.id, status: StatusMatricula.ATIVA },
        }),
        this.prisma.matricula.count({
          where: { unidadeId: capacitacao.id, status: StatusMatricula.LISTA_ESPERA },
        }),
        this.prisma.elegibilidadePorUnidade.count({
          where: { unidadeId: capacitacao.id, status: StatusElegibilidade.APROVADO },
        }),
      ]);
      linhas.push(
        this.montarPulsoCapacidade(capacitacao, vagasAgg._sum.vagasTotais ?? 0, ativos, espera, beneficiarios),
      );
    }

    // --- Esportivo ---
    const esportivo = porTipo.get(TipoUnidade.ESPORTIVO);
    if (esportivo) {
      const [vagasAgg, ativos, espera, beneficiarios] = await this.prisma.$transaction([
        this.prisma.turmaEsportiva.aggregate({
          _sum: { vagasTotais: true },
          where: { unidadeId: esportivo.id, status: { not: StatusTurma.ENCERRADA } },
        }),
        this.prisma.matriculaEsportiva.count({
          where: { unidadeId: esportivo.id, status: StatusMatricula.ATIVA },
        }),
        this.prisma.matriculaEsportiva.count({
          where: { unidadeId: esportivo.id, status: StatusMatricula.LISTA_ESPERA },
        }),
        this.prisma.elegibilidadePorUnidade.count({
          where: { unidadeId: esportivo.id, status: StatusElegibilidade.APROVADO },
        }),
      ]);
      linhas.push(
        this.montarPulsoCapacidade(esportivo, vagasAgg._sum.vagasTotais ?? 0, ativos, espera, beneficiarios),
      );
    }

    // --- Educacional / Creche (capacidade vem das turmas infantis) ---
    const educacional = porTipo.get(TipoUnidade.EDUCACIONAL);
    if (educacional) {
      const [vagasAgg, ativos, beneficiarios] = await this.prisma.$transaction([
        this.prisma.turmaInfantil.aggregate({
          _sum: { capacidade: true },
          where: { unidadeId: educacional.id, ativa: true },
        }),
        this.prisma.matriculaInfantil.count({
          where: { unidadeId: educacional.id, ativa: true },
        }),
        this.prisma.elegibilidadePorUnidade.count({
          where: { unidadeId: educacional.id, status: StatusElegibilidade.APROVADO },
        }),
      ]);
      linhas.push(
        this.montarPulsoCapacidade(educacional, vagasAgg._sum.capacidade ?? 0, ativos, 0, beneficiarios),
      );
    }

    // KPIs do topo (só as unidades por capacidade entram na ocupação média)
    const comCapacidade = linhas.filter((l) => l.modo === "capacidade" && (l.vagas ?? 0) > 0);
    const ocupacaoMedia =
      comCapacidade.length > 0
        ? Math.round(
            comCapacidade.reduce((acc, l) => acc + (l.ocupacaoPct ?? 0), 0) / comCapacidade.length,
          )
        : null;
    const vagasPreenchidas = linhas.reduce((acc, l) => acc + (l.ativos ?? 0), 0);
    const listaEspera = linhas.reduce((acc, l) => acc + (l.listaEspera ?? 0), 0);
    const sobPressao = comCapacidade.filter((l) => (l.ocupacaoPct ?? 0) >= 90).length;

    return {
      kpis: { ocupacaoMedia, vagasPreenchidas, listaEspera, sobPressao },
      unidades: linhas,
    };
  }

  private montarPulsoCapacidade(
    unidade: { tipo: TipoUnidade; nome: string; slug: string },
    vagas: number,
    ativos: number,
    espera: number,
    beneficiarios: number,
  ): UnidadePulso {
    // vagas 0 = sem turma aberta → ocupação indefinida (não é "0% com folga")
    const ocupacaoPct = vagas > 0 ? Math.round((ativos / vagas) * 100) : null;
    return {
      tipo: unidade.tipo,
      nome: unidade.nome,
      slug: unidade.slug,
      modo: "capacidade",
      vagas,
      ativos,
      listaEspera: espera,
      ocupacaoPct,
      beneficiarios,
      agendamentosAtivos: null,
      atendimentosMes: null,
    };
  }

  // ============================================================
  // Impacto — tendência dos últimos 12 meses
  // ============================================================
  async impacto(user: AuthenticatedUser) {
    this.auditarLeitura(user, "impacto");

    // generate_series garante 12 meses (preenche meses sem dado com zero) —
    // sem isso o gráfico "salta" meses vazios e engana a leitura.
    const serieFamilias = await this.prisma.$queryRaw<{ mes: string; total: number }[]>`
      SELECT to_char(m.mes, 'YYYY-MM') AS mes, count(f.id)::int AS total
      FROM generate_series(
        date_trunc('month', now()) - interval '11 months',
        date_trunc('month', now()),
        interval '1 month'
      ) AS m(mes)
      LEFT JOIN fichas_cidadas f ON date_trunc('month', f."criadoEm") = m.mes
      GROUP BY m.mes ORDER BY m.mes
    `;

    const serieAtendimentos = await this.prisma.$queryRaw<{ mes: string; total: number }[]>`
      SELECT to_char(m.mes, 'YYYY-MM') AS mes, count(a.id)::int AS total
      FROM generate_series(
        date_trunc('month', now()) - interval '11 months',
        date_trunc('month', now()),
        interval '1 month'
      ) AS m(mes)
      LEFT JOIN atendimentos a
        ON a."encerradoEm" IS NOT NULL
        AND date_trunc('month', a."encerradoEm") = m.mes
      GROUP BY m.mes ORDER BY m.mes
    `;

    // Novas famílias atendidas por unidade nos últimos 12 meses (volume de crescimento,
    // medido pelas elegibilidades APROVADAS criadas no período — sem % inventado).
    const crescimentoPorUnidade = await this.prisma.$queryRaw<
      { tipo: string; nome: string; total: number }[]
    >`
      SELECT u.tipo::text AS tipo, u.nome AS nome, count(*)::int AS total
      FROM elegibilidades e
      JOIN unidades u ON u.id = e."unidadeId"
      WHERE e.status = 'APROVADO'::"StatusElegibilidade"
        AND e."criadoEm" >= date_trunc('month', now()) - interval '11 months'
      GROUP BY u.tipo, u.nome
      ORDER BY total DESC
    `;

    const [familiasAtendidas, atendimentosMes] = await this.prisma.$transaction([
      this.prisma.fichaCidada.count({
        where: { ativa: true, elegibilidades: { some: { status: StatusElegibilidade.APROVADO } } },
      }),
      this.prisma.atendimento.count({ where: { encerradoEm: { gte: this.inicioDoMes() } } }),
    ]);

    return {
      kpis: { familiasAtendidas, atendimentosMes },
      serieFamilias,
      serieAtendimentos,
      crescimentoPorUnidade,
    };
  }

  // ============================================================
  // Impacto longitudinal — séries temporais por mês (últimos N meses)
  // ============================================================
  /**
   * Cruza as verticais numa visão LONGITUDINAL: para cada um dos últimos N
   * meses, conta atendimentos, matrículas (capacitação+infantil+esportiva),
   * graduações, certificados e presenças efetivas (PRESENTE) — aula + treino +
   * creche. generate_series garante a grade de N meses (meses sem dado = 0),
   * para o gráfico não "pular" buracos e enganar a leitura. Só agregação READ
   * sobre o que o banco já tem; sem IA, sem schema novo.
   */
  async impactoSeries(user: AuthenticatedUser, mesesBruto?: string | number) {
    this.auditarLeitura(user, "impacto-series");
    const meses = this.normalizarMeses(mesesBruto);

    // Cada série usa a mesma grade de meses (generate_series) com LEFT JOIN na
    // coluna de data própria daquela entidade. ($queryRaw não interpola
    // identificadores, mas `meses` é um inteiro saneado por normalizarMeses.)
    const offset = meses - 1;

    const serieAtendimentos = await this.serieMensal(offset, "atendimentos", "encerradoEm", {
      whereExtra: '"encerradoEm" IS NOT NULL',
    });
    const serieMatriculas = await this.serieMatriculas(offset);
    const serieGraduacoes = await this.serieMensal(offset, "graduacoes", "concedidaEm");
    const serieCertificados = await this.serieMensal(offset, "certificados", "emitidoEm");
    const seriePresencas = await this.seriePresencas(offset);

    // Totais do período (a barra de topo da tela) — soma das próprias séries,
    // garantindo coerência entre o número grande e o mini-gráfico.
    const somar = (s: { total: number }[]) => s.reduce((a, p) => a + p.total, 0);

    return {
      meses,
      kpis: {
        atendimentos: somar(serieAtendimentos),
        matriculas: somar(serieMatriculas),
        graduacoes: somar(serieGraduacoes),
        certificados: somar(serieCertificados),
        presencas: somar(seriePresencas),
      },
      series: [
        { chave: "atendimentos", label: "Atendimentos", pontos: serieAtendimentos },
        { chave: "matriculas", label: "Matrículas", pontos: serieMatriculas },
        { chave: "graduacoes", label: "Graduações", pontos: serieGraduacoes },
        { chave: "certificados", label: "Certificados", pontos: serieCertificados },
        { chave: "presencas", label: "Presenças", pontos: seriePresencas },
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
   * Série mensal genérica para uma tabela com UMA coluna de data. `tabela` e
   * `coluna` vêm SÓ de literais internos deste service (nunca do usuário);
   * `offset` é inteiro saneado. Sem entrada externa interpolada → sem SQLi.
   */
  private serieMensal(
    offset: number,
    tabela: string,
    coluna: string,
    opts?: { whereExtra?: string },
  ) {
    const where = opts?.whereExtra ? `AND t.${opts.whereExtra}` : "";
    const sql = `
      SELECT to_char(m.mes, 'YYYY-MM') AS mes, count(t.id)::int AS total
      FROM generate_series(
        date_trunc('month', now()) - make_interval(months => ${offset}),
        date_trunc('month', now()),
        interval '1 month'
      ) AS m(mes)
      LEFT JOIN ${tabela} t
        ON date_trunc('month', t."${coluna}") = m.mes ${where}
      GROUP BY m.mes ORDER BY m.mes
    `;
    return this.prisma.$queryRawUnsafe<{ mes: string; total: number }[]>(sql);
  }

  /** Matrículas no mês: soma capacitação + infantil + esportiva (criadoEm). */
  private serieMatriculas(offset: number) {
    const sql = `
      SELECT to_char(m.mes, 'YYYY-MM') AS mes, count(t.id)::int AS total
      FROM generate_series(
        date_trunc('month', now()) - make_interval(months => ${offset}),
        date_trunc('month', now()),
        interval '1 month'
      ) AS m(mes)
      LEFT JOIN (
        SELECT id, "criadoEm" FROM matriculas
        UNION ALL SELECT id, "criadoEm" FROM matriculas_infantis
        UNION ALL SELECT id, "criadoEm" FROM matriculas_esportivas
      ) t ON date_trunc('month', t."criadoEm") = m.mes
      GROUP BY m.mes ORDER BY m.mes
    `;
    return this.prisma.$queryRawUnsafe<{ mes: string; total: number }[]>(sql);
  }

  /**
   * Presenças efetivas no mês: aula (Presenca→Aula.data) + treino
   * (PresencaTreino→TreinoEsportivo.data) + creche (PresencaCreche.data).
   * Só PRESENTE conta como "presença" (falta/justificada/atraso ficam fora);
   * creche conta resposta SIM. A data é a DO ENCONTRO, não a do registro.
   */
  private seriePresencas(offset: number) {
    const sql = `
      SELECT to_char(m.mes, 'YYYY-MM') AS mes, count(t.dia)::int AS total
      FROM generate_series(
        date_trunc('month', now()) - make_interval(months => ${offset}),
        date_trunc('month', now()),
        interval '1 month'
      ) AS m(mes)
      LEFT JOIN (
        SELECT a.data AS dia
          FROM presencas p JOIN aulas a ON a.id = p."aulaId"
          WHERE p.status = 'PRESENTE'::"StatusPresenca"
        UNION ALL
        SELECT tr.data AS dia
          FROM presencas_treino pt JOIN treinos_esportivos tr ON tr.id = pt."treinoId"
          WHERE pt.status = 'PRESENTE'::"StatusPresenca"
        UNION ALL
        SELECT pc.data::timestamp AS dia
          FROM presencas_creche pc
          WHERE pc.resposta = 'SIM'::"RespostaPresenca"
      ) t ON date_trunc('month', t.dia) = m.mes
      GROUP BY m.mes ORDER BY m.mes
    `;
    return this.prisma.$queryRawUnsafe<{ mes: string; total: number }[]>(sql);
  }

  // ============================================================
  // Saúde populacional — retrato AGREGADO e ANÔNIMO do dado clínico
  // ============================================================
  /**
   * Visão de saúde populacional para a Presidência: SÓ contagens/agregados
   * sobre o dado clínico que o banco já tem (condições crônicas, alergias,
   * triagens de enfermagem, atendimentos selados). NUNCA expõe ficha/paciente
   * individual — a presidência vê "quantos", jamais "quem". A leitura entra na
   * trilha LGPD. Sem geo falso, sem IA, sem schema novo (zero-migration).
   *
   * Recortes:
   *  - faixa etária dos beneficiários COM dado clínico (condição/alergia ativa);
   *  - top condições crônicas por descrição (+ CID-10 quando houver);
   *  - alergias por gravidade;
   *  - triagens de enfermagem por classificação de risco (acolhimento);
   *  - atendimentos selados por CID-10 (top motivos registrados);
   *  - cobertura clínica por bairro (famílias com ≥1 condição/alergia ativa).
   */
  async saude(user: AuthenticatedUser) {
    this.auditarLeitura(user, "saude");

    // KPIs de volume clínico (contagens diretas). Pessoas distintas com condição
    // crônica ativa e com alergia ativa são contadas por ficha (titular) e
    // membro separadamente e somadas — é uma estimativa de "pessoas alcançadas
    // pelo cuidado", honesta porque cada (fichaId|membroId) é uma pessoa.
    const [
      condicoesAtivas,
      alergiasAtivas,
      triagens,
      atendimentosSelados,
      pessoasComCondicao,
      pessoasComAlergia,
    ] = await this.prisma.$transaction([
      this.prisma.condicaoCronica.count({ where: { ativa: true } }),
      this.prisma.alergia.count({ where: { ativa: true } }),
      this.prisma.triagemEnfermagem.count(),
      this.prisma.atendimento.count({ where: { encerradoEm: { not: null } } }),
      this.prisma.condicaoCronica.count({ where: { ativa: true } }),
      this.prisma.alergia.count({ where: { ativa: true } }),
    ]);

    // Top condições crônicas ATIVAS por descrição (+ CID-10 quando houver).
    // Agregado por texto da descrição — nenhum vínculo com paciente. Top 8.
    const condicaoGrupos = await this.prisma.condicaoCronica.groupBy({
      by: ["descricao", "cid10"],
      where: { ativa: true },
      _count: { _all: true },
      orderBy: { _count: { descricao: "desc" } },
    });
    const porCondicao = condicaoGrupos
      .map((c) => ({
        descricao: c.descricao,
        cid10: c.cid10 ?? null,
        total: c._count._all,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // Alergias ativas por gravidade (LEVE/MODERADA/GRAVE/Não classificada).
    const alergiaGrupos = await this.prisma.alergia.groupBy({
      by: ["gravidade"],
      where: { ativa: true },
      _count: { _all: true },
    });
    const ORDEM_GRAVIDADE = ["GRAVE", "MODERADA", "LEVE", "Não classificada"];
    const alergiasPorGravidade = ORDEM_GRAVIDADE.map((g) => ({
      gravidade: g,
      total:
        alergiaGrupos.find((a) => (a.gravidade ?? "Não classificada") === g)?._count._all ?? 0,
    })).filter((a) => a.total > 0);

    // Triagens de enfermagem por classificação de risco (protocolo de acolhimento).
    const triagemGrupos = await this.prisma.triagemEnfermagem.groupBy({
      by: ["classificacaoRisco"],
      _count: { _all: true },
    });
    const ORDEM_RISCO = ["VERMELHO", "LARANJA", "AMARELO", "VERDE", "AZUL"];
    const triagensPorRisco = ORDEM_RISCO.map((r) => ({
      risco: r,
      total: triagemGrupos.find((t) => t.classificacaoRisco === r)?._count._all ?? 0,
    })).filter((t) => t.total > 0);

    // Atendimentos selados por CID-10 (top motivos clínicos registrados). Só
    // entram atendimentos encerrados com CID preenchido; agregado por código.
    const cidGrupos = await this.prisma.atendimento.groupBy({
      by: ["cid10"],
      where: { encerradoEm: { not: null }, cid10: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { cid10: "desc" } },
    });
    const porCid10 = cidGrupos
      .map((c) => ({ cid10: c.cid10 as string, total: c._count._all }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // Faixa etária das PESSOAS (titular OU membro) com ≥1 condição crônica OU
    // alergia ATIVA. Cobre o universo "sob cuidado clínico". Conta cada pessoa
    // uma vez (DISTINCT por origem+id) e só dado real; sem nome/CPF na saída.
    const faixaEtariaClinica = await this.prisma.$queryRaw<{ faixa: string; total: number }[]>`
      SELECT faixa, count(*)::int AS total FROM (
        SELECT
          CASE
            WHEN idade <= 6 THEN '0-6'
            WHEN idade <= 17 THEN '7-17'
            WHEN idade <= 39 THEN '18-39'
            WHEN idade <= 59 THEN '40-59'
            ELSE '60+'
          END AS faixa
        FROM (
          -- titulares com condição/alergia ativa
          SELECT DISTINCT f.id AS pid, 'F' AS origem,
                 date_part('year', age(f."dataNascimento"))::int AS idade
          FROM fichas_cidadas f
          WHERE f.ativa = true
            AND (
              EXISTS (SELECT 1 FROM condicoes_cronicas c
                      WHERE c."fichaId" = f.id AND c."membroId" IS NULL AND c.ativa = true)
              OR EXISTS (SELECT 1 FROM alergias a
                      WHERE a."fichaId" = f.id AND a."membroId" IS NULL AND a.ativa = true)
            )
          UNION ALL
          -- membros com condição/alergia ativa
          SELECT DISTINCT m.id AS pid, 'M' AS origem,
                 date_part('year', age(m."dataNascimento"))::int AS idade
          FROM membros_familiares m
          JOIN fichas_cidadas f ON f.id = m."fichaId" AND f.ativa = true
          WHERE
              EXISTS (SELECT 1 FROM condicoes_cronicas c
                      WHERE c."membroId" = m.id AND c.ativa = true)
              OR EXISTS (SELECT 1 FROM alergias a
                      WHERE a."membroId" = m.id AND a.ativa = true)
        ) pessoas
      ) faixas
      GROUP BY faixa
    `;

    // Cobertura clínica por bairro: nº de FAMÍLIAS ativas com ≥1 condição OU
    // alergia ATIVA (no titular ou em qualquer membro), agrupado pelo bairro do
    // endereço cadastrado. Top 6 + "Outros" + "Não informado" (mesmo consolidado).
    const bairroClinicoRaw = await this.prisma.$queryRaw<
      { bairro: string | null; total: number }[]
    >`
      SELECT f.bairro AS bairro, count(*)::int AS total FROM (
        SELECT DISTINCT f.id, f.bairro
        FROM fichas_cidadas f
        WHERE f.ativa = true
          AND (
            EXISTS (SELECT 1 FROM condicoes_cronicas c WHERE c."fichaId" = f.id AND c.ativa = true)
            OR EXISTS (SELECT 1 FROM alergias a WHERE a."fichaId" = f.id AND a.ativa = true)
          )
      ) f
      GROUP BY f.bairro
    `;
    const porBairro = this.consolidarBairros(
      bairroClinicoRaw.map((b) => ({ bairro: b.bairro, _count: { _all: b.total } })),
    );

    return {
      tipo: "saude-populacional" as const,
      kpis: {
        condicoesAtivas,
        alergiasAtivas,
        triagens,
        atendimentosSelados,
        // pessoas distintas alcançadas pelo cuidado (titular OU membro)
        pessoasSobCuidado: faixaEtariaClinica.reduce((s, f) => s + f.total, 0),
      },
      // mantidos para coerência interna/depuração das somas
      totais: { pessoasComCondicao, pessoasComAlergia },
      faixaEtaria: this.ordenarFaixas(faixaEtariaClinica),
      porCondicao,
      alergiasPorGravidade,
      triagensPorRisco,
      porCid10,
      porBairro,
    };
  }

  // ============================================================
  // Jornada da Família — o diferencial: famílias em N unidades
  // ============================================================
  async jornada(user: AuthenticatedUser) {
    this.auditarLeitura(user, "jornada");

    const distribuicao = await this.prisma.$queryRaw<{ n_unidades: number; total: number }[]>`
      SELECT n_unidades, count(*)::int AS total FROM (
        SELECT f.id, count(DISTINCT e."unidadeId")::int AS n_unidades
        FROM fichas_cidadas f
        JOIN elegibilidades e ON e."fichaId" = f.id
          AND e.status = 'APROVADO'::"StatusElegibilidade"
        WHERE f.ativa = true
        GROUP BY f.id
      ) sub
      GROUP BY n_unidades
      ORDER BY n_unidades
    `;

    // Pontes mais comuns: pares NÃO-ordenados de unidades que a mesma família toca
    const pontesRaw = await this.prisma.$queryRaw<
      { tipo_a: string; tipo_b: string; total: number }[]
    >`
      SELECT u1.tipo::text AS tipo_a, u2.tipo::text AS tipo_b, count(*)::int AS total
      FROM elegibilidades e1
      JOIN elegibilidades e2
        ON e2."fichaId" = e1."fichaId"
        AND e1."unidadeId" < e2."unidadeId"
        AND e1.status = 'APROVADO'::"StatusElegibilidade"
        AND e2.status = 'APROVADO'::"StatusElegibilidade"
      JOIN unidades u1 ON u1.id = e1."unidadeId"
      JOIN unidades u2 ON u2.id = e2."unidadeId"
      JOIN fichas_cidadas f ON f.id = e1."fichaId" AND f.ativa = true
      GROUP BY u1.tipo, u2.tipo
      ORDER BY total DESC
      LIMIT 6
    `;

    // Constelações: famílias que mais cruzam unidades, ANONIMIZADAS (código, não nome)
    const constelacoesRaw = await this.prisma.$queryRaw<
      { protocolo: string; pessoas: number; unidades: string[] }[]
    >`
      SELECT f.protocolo,
        (1 + (SELECT count(*) FROM membros_familiares m WHERE m."fichaId" = f.id))::int AS pessoas,
        array_agg(DISTINCT u.tipo::text) AS unidades
      FROM fichas_cidadas f
      JOIN elegibilidades e ON e."fichaId" = f.id
        AND e.status = 'APROVADO'::"StatusElegibilidade"
      JOIN unidades u ON u.id = e."unidadeId"
      WHERE f.ativa = true
      GROUP BY f.id, f.protocolo
      HAVING count(DISTINCT e."unidadeId") >= 2
      ORDER BY count(DISTINCT e."unidadeId") DESC, pessoas DESC
      LIMIT 6
    `;

    const familiasUnicas = distribuicao.reduce((acc, d) => acc + d.total, 0);
    const conta = (min: number) =>
      distribuicao.filter((d) => d.n_unidades >= min).reduce((acc, d) => acc + d.total, 0);
    const porN = (n: number) => distribuicao.find((d) => d.n_unidades === n)?.total ?? 0;

    return {
      familiasUnicas,
      cross2mais: conta(2),
      cross3mais: conta(3),
      quatroUnidades: porN(4),
      distribuicao: [
        { unidades: 1, total: porN(1) },
        { unidades: 2, total: porN(2) },
        { unidades: 3, total: porN(3) },
        { unidades: 4, total: porN(4) },
      ],
      pontes: pontesRaw,
      constelacoes: constelacoesRaw.map((c, i) => ({
        // anonimização total: código sequencial local, sem nenhum vínculo com o
        // protocolo real (evita re-identificação por sufixo + nº pessoas + unidades)
        codigo: `Família ${i + 1}`,
        pessoas: c.pessoas,
        unidades: c.unidades,
      })),
    };
  }

  // ============================================================
  // Prestação de contas — números reais de um período (sem IA)
  // ============================================================
  private resolverPeriodo(chave?: string): { chave: PeriodoChave; label: string; inicio: Date } {
    const valida: PeriodoChave = chave === "mes" || chave === "ano" || chave === "12m" ? chave : "12m";
    const agora = new Date();
    let inicio: Date;
    if (valida === "mes") {
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
    } else if (valida === "ano") {
      inicio = new Date(agora.getFullYear(), 0, 1);
    } else {
      // últimos 12 meses (início do mês de 11 meses atrás)
      inicio = new Date(agora.getFullYear(), agora.getMonth() - 11, 1);
    }
    return { chave: valida, label: PERIODO_LABEL[valida], inicio };
  }

  /** Agrega os números de um período. SEM auditoria (uso interno do JSON e do PDF). */
  async agregarPrestacao(chave?: string) {
    const { chave: periodo, label, inicio } = this.resolverPeriodo(chave);

    const [novasFichas, atendimentos, certificados, graduacoes, matCap, matEdu, matEsp] =
      await this.prisma.$transaction([
        this.prisma.fichaCidada.count({ where: { ativa: true, criadoEm: { gte: inicio } } }),
        this.prisma.atendimento.count({ where: { encerradoEm: { gte: inicio } } }),
        this.prisma.certificado.count({ where: { emitidoEm: { gte: inicio } } }),
        this.prisma.graduacao.count({ where: { concedidaEm: { gte: inicio } } }),
        this.prisma.matricula.count({ where: { criadoEm: { gte: inicio } } }),
        this.prisma.matriculaInfantil.count({ where: { criadoEm: { gte: inicio } } }),
        this.prisma.matriculaEsportiva.count({ where: { criadoEm: { gte: inicio } } }),
      ]);

    const [familiasAtendidas, fichasAtivas, membros] = await this.prisma.$transaction([
      this.prisma.fichaCidada.count({
        where: { ativa: true, elegibilidades: { some: { status: StatusElegibilidade.APROVADO } } },
      }),
      this.prisma.fichaCidada.count({ where: { ativa: true } }),
      this.prisma.membroFamiliar.count({ where: { ficha: { ativa: true } } }),
    ]);

    // % de famílias atendidas em 2+ unidades (o diferencial — vai no relatório)
    const dist = await this.prisma.$queryRaw<{ n_unidades: number; total: number }[]>`
      SELECT n_unidades, count(*)::int AS total FROM (
        SELECT f.id, count(DISTINCT e."unidadeId")::int AS n_unidades
        FROM fichas_cidadas f
        JOIN elegibilidades e ON e."fichaId" = f.id
          AND e.status = 'APROVADO'::"StatusElegibilidade"
        WHERE f.ativa = true
        GROUP BY f.id
      ) sub
      GROUP BY n_unidades
    `;
    const familiasUnicas = dist.reduce((a, d) => a + d.total, 0);
    const cross2mais = dist.filter((d) => d.n_unidades >= 2).reduce((a, d) => a + d.total, 0);
    const cross2maisPct = familiasUnicas > 0 ? Math.round((cross2mais / familiasUnicas) * 100) : 0;

    return {
      periodo: { chave: periodo, label, inicio: inicio.toISOString() },
      novas: { familias: novasFichas, matriculas: matCap + matEdu + matEsp },
      realizados: { atendimentos, certificados, graduacoes },
      base: {
        familiasAtendidas,
        pessoasImpactadas: fichasAtivas + membros,
        familiasUnicas,
        cross2mais,
        cross2maisPct,
      },
    };
  }

  /** Versão com trilha LGPD (consumo via tela). */
  async prestacaoContas(user: AuthenticatedUser, chave?: string) {
    this.auditarLeitura(user, "prestacao-contas");
    return this.agregarPrestacao(chave);
  }
}

type PeriodoChave = "mes" | "ano" | "12m";
const PERIODO_LABEL: Record<PeriodoChave, string> = {
  mes: "Este mês",
  ano: "Este ano",
  "12m": "Últimos 12 meses",
};

export type PrestacaoContas = Awaited<ReturnType<PresidenciaService["agregarPrestacao"]>>;

/** Linha de unidade no painel: por capacidade (creche/cursos/esporte) ou por volume (médico). */
interface UnidadePulso {
  tipo: TipoUnidade;
  nome: string;
  slug: string;
  modo: "capacidade" | "volume";
  vagas: number | null;
  ativos: number | null;
  listaEspera: number | null;
  ocupacaoPct: number | null;
  beneficiarios?: number;
  agendamentosAtivos: number | null;
  atendimentosMes: number | null;
}
