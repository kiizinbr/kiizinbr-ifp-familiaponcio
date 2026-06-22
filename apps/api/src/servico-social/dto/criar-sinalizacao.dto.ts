import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { PrioridadeSinal, TipoSinalizacao } from "@ifp/database";

export class CriarSinalizacaoDto {
  @IsString()
  fichaId!: string;

  @IsOptional()
  @IsString()
  membroId?: string;

  // Ignorado pelo servidor: a origem é sempre a unidade do profissional logado
  // (server-authoritative; evita origem forjada na auditoria). Opcional só para
  // não quebrar clientes que ainda enviam o campo.
  @IsOptional()
  @IsString()
  unidadeOrigemSlug?: string;

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
