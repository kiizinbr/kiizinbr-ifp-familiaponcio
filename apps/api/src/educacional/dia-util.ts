import { BadRequestException } from "@nestjs/common";

/**
 * Fuso oficial do negócio (mesma decisão do módulo médico): em Docker o
 * processo roda em UTC e o "dia" cortaria às 21h de Brasília. Offset fixo:
 * o Brasil não tem horário de verão desde 2019.
 */
const TZ_NEGOCIO = "America/Sao_Paulo";
const OFFSET_SP = "-03:00";

/** "Hoje" (AAAA-MM-DD) no fuso do negócio, independente do TZ do processo. */
export function diaHojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ_NEGOCIO }).format(new Date());
}

/**
 * Janela [00:00, 24:00) do dia em America/Sao_Paulo.
 * `dataDb` é o valor para colunas `@db.Date` do Prisma (meia-noite UTC do dia civil).
 */
export function janelaDoDiaSP(data?: string) {
  const dia = data ?? diaHojeSP();
  const inicio = new Date(`${dia}T00:00:00${OFFSET_SP}`);
  if (Number.isNaN(inicio.getTime())) {
    throw new BadRequestException("Data inválida — use o formato AAAA-MM-DD.");
  }
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  const dataDb = new Date(`${dia}T00:00:00.000Z`);
  return { dia, inicio, fim, dataDb };
}

/**
 * Fim do dia (23:59:59.999) em America/Sao_Paulo. Para validades inclusivas
 * "até o dia X": gravar `new Date(dia)` puro vira meia-noite UTC = 21h de
 * Brasília do dia ANTERIOR, vencendo a autorização ~3h cedo e no dia errado.
 */
export function fimDoDiaSP(data: string): Date {
  const dia = data.slice(0, 10);
  const fim = new Date(`${dia}T23:59:59.999${OFFSET_SP}`);
  if (Number.isNaN(fim.getTime())) {
    throw new BadRequestException("Data inválida — use o formato AAAA-MM-DD.");
  }
  return fim;
}
