import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CriarAgendamentoDto {
  @IsString()
  fichaId!: string;

  /** Dependente atendido (membro da família); ausente = titular. */
  @IsOptional()
  @IsString()
  membroId?: string;

  @IsDateString()
  inicioEm!: string;

  /** Ausente = início + 30 minutos. */
  @IsOptional()
  @IsDateString()
  fimEm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}
