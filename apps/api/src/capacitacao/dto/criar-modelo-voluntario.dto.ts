import { IsOptional, IsString, MaxLength } from "class-validator";

export class CriarModeloVoluntarioDto {
  @IsString()
  @MaxLength(120)
  nomeCompleto!: string;

  /** Contato para confirmar presença (opcional, dado pessoal). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  observacao?: string;
}
