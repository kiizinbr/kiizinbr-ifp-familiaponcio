import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class VincularProfissionalDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  especialidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  registroConselho?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  ufConselho?: string;
}

export class EditarProfissionalDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  especialidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  registroConselho?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  ufConselho?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
