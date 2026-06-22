import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { PrioridadeSinal, TipoSinalizacao } from "@ifp/database";

export class CriarSinalizacaoDto {
  @IsString()
  fichaId!: string;

  @IsOptional()
  @IsString()
  membroId?: string;

  @IsString()
  unidadeOrigemSlug!: string;

  @IsOptional()
  @IsEnum(TipoSinalizacao)
  tipo?: TipoSinalizacao;

  @IsOptional()
  @IsEnum(PrioridadeSinal)
  prioridade?: PrioridadeSinal;

  // LGPD: descreva o motivo referenciando a família, sem copiar prontuário/dados sensíveis.
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  descricao!: string;
}
