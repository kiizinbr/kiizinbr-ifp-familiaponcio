import type { Prisma, StatusNota } from "@prisma/client";
import { db } from "@/lib/db";
import { aplicarTransicaoConsulta } from "@/lib/medico/agenda";

/**
 * Núcleo do prontuário médico (F1.B.2). Este arquivo concentra as funções PURAS
 * (sem acesso a banco) — IMC, validação de sinais vitais e a máquina de estados
 * da nota. A parte transacional (salvarRascunho/assinarNota/adicionarAddendo)
 * entra na T5, neste mesmo arquivo.
 */

/**
 * Select do contexto clínico fixo do paciente (timeline /medico/pacientes/[id]).
 * Vive aqui — não inline na page — pra que o teste de integração
 * (tests/unit/medico-paciente-timeline.test.ts) execute EXATAMENTE o mesmo
 * select contra o PG real: `tsc` não valida campos de select passados ao
 * Prisma (SelectSubset aceita campo inexistente, ex.: `medicamentos` em vez de
 * `medicamentosEmUso`) — o erro só estoura em runtime como
 * PrismaClientValidationError. O `satisfies` pega drift em compile-time E o
 * teste cobre o runtime.
 */
export const SELECT_CONTEXTO_PACIENTE = {
  id: true,
  nomeCompleto: true,
  nomeSocial: true,
  dataNascimento: true,
  genero: true,
  tipoSanguineo: true,
  alergias: true,
  condicoesCronicas: true,
  medicamentosEmUso: true,
} as const satisfies Prisma.CidadaoSelect;

export interface SinaisVitaisInput {
  paSistolica?: number | null;
  paDiastolica?: number | null;
  fcBpm?: number | null;
  frIrpm?: number | null;
  tempC?: number | null;
  pesoKg?: number | null;
  alturaCm?: number | null;
  spo2?: number | null;
}

/** Faixas plausíveis por sinal vital (warning, nunca bloqueia — §0.5). [min, max] inclusivo. */
const FAIXAS_PLAUSIVEIS: Record<keyof SinaisVitaisInput, readonly [number, number]> = {
  paSistolica: [70, 250],
  paDiastolica: [40, 150],
  fcBpm: [30, 220],
  frIrpm: [8, 60],
  tempC: [30, 43],
  pesoKg: [0.5, 400],
  alturaCm: [30, 250],
  spo2: [50, 100],
};

/**
 * IMC derivado (NÃO persistido — §0.5). Retorna `null` se peso ou altura
 * estiverem ausentes OU fora da faixa plausível (reusa FAIXAS_PLAUSIVEIS:
 * pesoKg 0.5–400, alturaCm 30–250). Guard display-only para o dado migrado da
 * Amplimed, que gravava altura em METROS — `intSeguro(1.68) = 2` passou batido
 * e o IMC derivado explodia (93.4 kg / 0.02 m² = 233500). A UI já trata `null`
 * como "—"; a nota assinada de origem NÃO é tocada. Arredonda 1 casa.
 */
export function calcularImc(
  pesoKg: number | null | undefined,
  alturaCm: number | null | undefined,
): number | null {
  if (pesoKg == null || alturaCm == null) return null;
  const [pesoMin, pesoMax] = FAIXAS_PLAUSIVEIS.pesoKg;
  const [alturaMin, alturaMax] = FAIXAS_PLAUSIVEIS.alturaCm;
  if (pesoKg < pesoMin || pesoKg > pesoMax) return null;
  if (alturaCm < alturaMin || alturaCm > alturaMax) return null;
  const alturaM = alturaCm / 100;
  const imc = pesoKg / (alturaM * alturaM);
  return Math.round(imc * 10) / 10;
}

/**
 * Formata um sinal vital migrado para EXIBIÇÃO. Reusa FAIXAS_PLAUSIVEIS (mesma
 * fonte do guard do IMC). Valor ausente OU fora de faixa → "—" (não reescreve a
 * nota; o dado sujo segue no banco, só paramos de MOSTRAR lixo). Caso real:
 * altura migrada da Amplimed em metros → alturaCm=2 (intSeguro(1.68)) → "—".
 * `unidade` opcional concatena (ex.: " cm"); só aparece quando o valor é válido.
 */
export function formatVitalSeguro(
  campo: keyof SinaisVitaisInput,
  valor: number | null | undefined,
  unidade?: string,
): string {
  if (valor == null) return "—";
  const [min, max] = FAIXAS_PLAUSIVEIS[campo];
  if (valor < min || valor > max) return "—";
  return unidade ? `${valor}${unidade}` : String(valor);
}

export interface VitalWarning {
  campo: keyof SinaisVitaisInput;
  valor: number;
  mensagem: string;
}

/**
 * Valida sinais vitais como WARNING — nunca lança, nunca bloqueia o atendimento (§0.5).
 * Campos ausentes/null são ignorados. Retorna [] se tudo plausível.
 */
export function validarSinaisVitais(v: SinaisVitaisInput): VitalWarning[] {
  const warnings: VitalWarning[] = [];
  const campos = Object.keys(FAIXAS_PLAUSIVEIS) as (keyof SinaisVitaisInput)[];
  for (const campo of campos) {
    const valor = v[campo];
    if (valor == null) continue;
    const [min, max] = FAIXAS_PLAUSIVEIS[campo];
    if (valor < min || valor > max) {
      warnings.push({
        campo,
        valor,
        mensagem: `${campo} fora da faixa plausível (${min}–${max}): ${valor}`,
      });
    }
  }
  return warnings;
}

/**
 * Máquina de estados PURA da nota de evolução:
 * `rascunho → assinada`; `assinada` é terminal/imutável (§0.4).
 */
const TRANSICOES_NOTA: Record<StatusNota, ReadonlySet<StatusNota>> = {
  rascunho: new Set<StatusNota>(["assinada"]),
  assinada: new Set<StatusNota>(),
};

export function podeTransicionarNota(de: StatusNota, para: StatusNota): boolean {
  return TRANSICOES_NOTA[de].has(para);
}

export class TransicaoNotaInvalidaError extends Error {
  constructor(
    public readonly de: StatusNota,
    public readonly para: StatusNota,
  ) {
    super(`Transição de nota inválida: ${de} → ${para}`);
    this.name = "TransicaoNotaInvalidaError";
  }
}

// ============================================================================
// T5 — orquestração transacional (salvar rascunho / assinar / addendo)
// ============================================================================

export class NotaAssinadaError extends Error {
  constructor(public readonly notaId: string) {
    super(`Nota ${notaId} já está assinada; correções devem ser feitas via addendo`);
    this.name = "NotaAssinadaError";
  }
}

export class NotaNaoAssinadaError extends Error {
  constructor(public readonly notaId: string) {
    super(`Nota ${notaId} ainda não está assinada; addendo só é permitido após a assinatura`);
    this.name = "NotaNaoAssinadaError";
  }
}

/**
 * A nota informada não pertence à consulta em que a ação está sendo feita.
 * Fecha o IDOR de assinar/addendar a nota de OUTRO paciente forjando notaId.
 */
export class NotaNaoPertenceAConsultaError extends Error {
  constructor(
    public readonly notaId: string,
    public readonly consultaId: string,
  ) {
    super(`Nota ${notaId} não pertence à consulta ${consultaId}`);
    this.name = "NotaNaoPertenceAConsultaError";
  }
}

export interface DiagnosticoInput {
  codigoCid?: string | null;
  descricao: string;
  principal?: boolean;
}

export interface SalvarRascunhoInput {
  consultaId: string;
  cidadaoId: string;
  profissionalId: string;
  texto?: string | null;
  vitais?: SinaisVitaisInput;
  diagnosticos?: DiagnosticoInput[];
}

/**
 * Salva (cria/atualiza) a nota de evolução enquanto a consulta está em
 * atendimento (§0.3). Rejeita com NotaAssinadaError se a nota já foi assinada
 * (imutável — §0.4). Quando `diagnosticos` é fornecido, recria a lista
 * (deleteMany → createMany).
 *
 * TOCTOU: em READ COMMITTED, ler status='rascunho' e depois fazer um UPDATE
 * incondicional (where só por consultaId) abriria janela pra sobrescrever uma
 * nota assinada por assinarNota numa corrida (duas abas / duplo submit). Por
 * isso o UPDATE é Compare-And-Set — `where: { consultaId, status: 'rascunho' }`
 * — mesmo padrão de core.reservarCAS na agenda. count===0 no caminho de update
 * significa que a nota foi assinada no meio da corrida → NotaAssinadaError.
 */
export async function salvarRascunho(input: SalvarRascunhoInput) {
  return db.$transaction(async (tx) => {
    const existente = await tx.notaEvolucao.findUnique({
      where: { consultaId: input.consultaId },
    });
    if (existente && existente.status === "assinada") {
      throw new NotaAssinadaError(existente.id);
    }

    const { vitais } = input;
    const dados = {
      cidadaoId: input.cidadaoId,
      profissionalId: input.profissionalId,
      texto: input.texto ?? null,
      paSistolica: vitais?.paSistolica ?? null,
      paDiastolica: vitais?.paDiastolica ?? null,
      fcBpm: vitais?.fcBpm ?? null,
      frIrpm: vitais?.frIrpm ?? null,
      tempC: vitais?.tempC ?? null,
      pesoKg: vitais?.pesoKg ?? null,
      alturaCm: vitais?.alturaCm ?? null,
      spo2: vitais?.spo2 ?? null,
    };

    let notaId: string;
    if (existente) {
      // CAS: só atualiza se AINDA for rascunho. Se assinarNota commitou no meio
      // da corrida, o predicado de status não casa e count===0 → rejeita.
      const atualizadas = await tx.notaEvolucao.updateMany({
        where: { consultaId: input.consultaId, status: "rascunho" },
        data: dados,
      });
      if (atualizadas.count === 0) {
        throw new NotaAssinadaError(existente.id);
      }
      notaId = existente.id;
    } else {
      // Sem nota ainda → cria. A unique em consultaId protege o double-create:
      // a 2ª transação concorrente estoura P2002 em vez de duplicar.
      const criada = await tx.notaEvolucao.create({
        data: { consultaId: input.consultaId, ...dados },
      });
      notaId = criada.id;
    }

    if (input.diagnosticos) {
      await tx.diagnosticoNota.deleteMany({ where: { notaId } });
      if (input.diagnosticos.length > 0) {
        await tx.diagnosticoNota.createMany({
          data: input.diagnosticos.map((d) => ({
            notaId,
            codigoCid: d.codigoCid ?? null,
            descricao: d.descricao,
            principal: d.principal ?? false,
          })),
        });
      }
    }

    return tx.notaEvolucao.findUniqueOrThrow({ where: { id: notaId } });
  });
}

/**
 * Assina a nota e conclui a consulta atomicamente (§3/§5 fluxo A). "Assinar e
 * concluir" = ato único: marca a nota como assinada (imutável) e transiciona a
 * consulta em_atendimento → realizada na MESMA transação, reusando
 * aplicarTransicaoConsulta (evita $transaction aninhado).
 */
export async function assinarNota(notaId: string, userId: string, consultaId: string) {
  return db.$transaction(async (tx) => {
    const nota = await tx.notaEvolucao.findUniqueOrThrow({ where: { id: notaId } });
    // IDOR guard: a nota tem que ser DESTA consulta (notaId vem do FormData do cliente).
    if (nota.consultaId !== consultaId) throw new NotaNaoPertenceAConsultaError(notaId, consultaId);
    if (!podeTransicionarNota(nota.status, "assinada")) {
      throw new TransicaoNotaInvalidaError(nota.status, "assinada");
    }
    const assinada = await tx.notaEvolucao.update({
      where: { id: notaId },
      data: { status: "assinada", assinadaEm: new Date(), assinadaPor: userId },
    });
    await aplicarTransicaoConsulta(tx, nota.consultaId, "realizada");
    return assinada;
  });
}

/**
 * Adiciona um addendo append-only a uma nota ASSINADA (§0.4). Nunca toca o
 * registro original. Rejeita com NotaNaoAssinadaError se a nota ainda é rascunho.
 */
export async function adicionarAddendo(
  notaId: string,
  autorId: string,
  texto: string,
  consultaId: string,
) {
  return db.$transaction(async (tx) => {
    const nota = await tx.notaEvolucao.findUniqueOrThrow({ where: { id: notaId } });
    // IDOR guard: a nota tem que ser DESTA consulta (notaId vem do FormData do cliente).
    if (nota.consultaId !== consultaId) throw new NotaNaoPertenceAConsultaError(notaId, consultaId);
    if (nota.status !== "assinada") {
      throw new NotaNaoAssinadaError(notaId);
    }
    return tx.addendoNota.create({ data: { notaId, autorId, texto } });
  });
}
