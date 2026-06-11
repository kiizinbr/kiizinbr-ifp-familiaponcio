import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CriarTurmaEsportivaDto {
  @IsString()
  modalidadeId!: string;

  /** Código único da turma, ex.: "JUDO-2026-1". */
  @IsString()
  @MaxLength(20)
  codigo!: string;

  @IsString()
  @MaxLength(60)
  diasHorario!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  local?: string;

  /** Categoria por idade, em anos (opcional). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  faixaEtariaMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  faixaEtariaMax?: number;

  @IsDateString()
  inicioEm!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  vagasTotais!: number;
}
