import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ConcederGraduacaoDto {
  /** Precisa pertencer à trilha de graduações da modalidade da turma. */
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nivel!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  observacao?: string;
}
