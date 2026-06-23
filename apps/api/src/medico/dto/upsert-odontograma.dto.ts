import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { EstadoDente } from "@ifp/database";

/** Quadrantes/dentes válidos na numeração FDI (32 permanentes). */
export const DENTES_FDI = [
  11, 12, 13, 14, 15, 16, 17, 18, // sup. dir.
  21, 22, 23, 24, 25, 26, 27, 28, // sup. esq.
  31, 32, 33, 34, 35, 36, 37, 38, // inf. esq.
  41, 42, 43, 44, 45, 46, 47, 48, // inf. dir.
] as const;

const FDI_SET = new Set<number>(DENTES_FDI);

/** Estado de um dente no odontograma. `numeroFdi` validado contra a tabela FDI. */
export class DenteEstadoDto {
  @IsInt()
  numeroFdi!: number;

  @IsEnum(EstadoDente)
  estado!: EstadoDente;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  procedimento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacoes?: string;
}

/**
 * Upsert do odontograma do atendimento: substitui o estado dos dentes enviados
 * e (opcional) atualiza o plano de tratamento geral. PUT = idempotente.
 */
export class UpsertOdontogramaDto {
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  observacoes?: string;

  @IsArray()
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => DenteEstadoDto)
  dentes!: DenteEstadoDto[];
}

/** Filtra/normaliza os dentes — só FDI válidos, dedup por número (último vence). */
export function normalizarDentes(dentes: DenteEstadoDto[]): DenteEstadoDto[] {
  const porNumero = new Map<number, DenteEstadoDto>();
  for (const d of dentes) {
    if (FDI_SET.has(d.numeroFdi)) porNumero.set(d.numeroFdi, d);
  }
  return [...porNumero.values()];
}
