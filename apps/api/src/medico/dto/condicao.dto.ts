import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class RegistrarCondicaoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  descricao!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  cid10?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacoes?: string;

  /** Dependente; ausente = titular da ficha. */
  @IsOptional()
  @IsString()
  membroId?: string;
}

export class AtualizarCondicaoDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  cid10?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacoes?: string;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
