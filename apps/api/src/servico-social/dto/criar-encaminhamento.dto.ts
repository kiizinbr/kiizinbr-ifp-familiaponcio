import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { PrioridadeSinal } from "@ifp/database";

export class CriarEncaminhamentoDto {
  @IsString()
  fichaId!: string;

  @IsString()
  unidadeOrigemSlug!: string;

  @IsString()
  unidadeDestinoSlug!: string;

  @IsOptional()
  @IsEnum(PrioridadeSinal)
  prioridade?: PrioridadeSinal;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivo!: string;
}
