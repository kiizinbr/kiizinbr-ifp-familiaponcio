import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CriarAulaDto {
  /** Data/hora da aula (ISO). */
  @IsDateString()
  data!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  conteudo?: string;
}
