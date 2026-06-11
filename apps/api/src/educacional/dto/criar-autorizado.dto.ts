import { IsBoolean, IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CriarAutorizadoDto {
  @IsString()
  @MinLength(3)
  nome!: string;

  /** Documento conferido no ato (RG/CPF/CNH). */
  @IsString()
  @MinLength(3)
  documento!: string;

  /** "mãe", "avó", "tio", "van escolar"... */
  @IsString()
  @MinLength(2)
  parentesco!: string;

  /** Foto para identificação visual no check-out. */
  @IsOptional()
  @IsString()
  fotoUrl?: string;

  @IsOptional()
  @IsDateString()
  vigenteAte?: string;

  /** Restrição judicial: o sistema BLOQUEIA a retirada (destaque vermelho). */
  @IsOptional()
  @IsBoolean()
  restricaoJudicial?: boolean;
}
