import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CriarTreinoDto {
  /** Data/hora do treino (ISO). */
  @IsDateString()
  data!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  conteudo?: string;
}
