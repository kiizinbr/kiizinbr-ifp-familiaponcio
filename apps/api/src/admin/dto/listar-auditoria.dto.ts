import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { AcaoAuditoria } from "@ifp/database";

/**
 * Filtros do visualizador da trilha de auditoria (governança LGPD).
 * Tudo opcional — sem filtro lista os eventos mais recentes paginados.
 */
export class ListarAuditoriaDto {
  /** cuid do ator (User.id) que praticou a ação. */
  @IsOptional()
  @IsString()
  ator?: string;

  @IsOptional()
  @IsEnum(AcaoAuditoria, { message: "ação inválida" })
  acao?: AcaoAuditoria;

  /** Nome da entidade auditada (ex.: "FichaCidada", "User"). */
  @IsOptional()
  @IsString()
  entidade?: string;

  /** Início do período (ISO 8601). Inclusivo. */
  @IsOptional()
  @IsISO8601({}, { message: "de deve ser uma data ISO" })
  de?: string;

  /** Fim do período (ISO 8601). Inclusivo até o fim do dia informado. */
  @IsOptional()
  @IsISO8601({}, { message: "ate deve ser uma data ISO" })
  ate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  perPage?: number;
}
