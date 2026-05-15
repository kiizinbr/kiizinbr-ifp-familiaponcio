import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Transform, Type } from "class-transformer";
import { StatusElegibilidade } from "@ifp/database";

export class ListFichasQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 20;

  /** Busca livre: aplica em nome (case-insensitive) e CPF (apenas dígitos). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  /** Slug da unidade (medico|capacitacao|esportivo|educacional). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unidade?: string;

  /** Status de elegibilidade em alguma unidade. */
  @IsOptional()
  @IsEnum(StatusElegibilidade)
  status?: StatusElegibilidade;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  ativa?: boolean;
}
