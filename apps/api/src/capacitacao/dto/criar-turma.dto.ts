import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CriarTurmaDto {
  @IsString()
  cursoId!: string;

  /** Código único da turma, ex.: "BB-2026-3". */
  @IsString()
  @MaxLength(20)
  codigo!: string;

  @IsString()
  @MaxLength(60)
  diasHorario!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sala?: string;

  @IsDateString()
  inicioEm!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  vagasTotais!: number;
}
