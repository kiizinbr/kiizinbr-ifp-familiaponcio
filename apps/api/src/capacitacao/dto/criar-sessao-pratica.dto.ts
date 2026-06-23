import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CriarSessaoPraticaDto {
  /** Turma à qual a sessão prática pertence. */
  @IsString()
  turmaId!: string;

  /** Título da sessão, ex.: "Sessão de cortes — módulo 2". */
  @IsString()
  @MaxLength(80)
  titulo!: string;

  /** Data/hora da sessão (ISO). */
  @IsDateString()
  data!: string;

  /** Quantos modelos voluntários a sessão comporta. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  vagasModelos?: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  observacao?: string;
}
