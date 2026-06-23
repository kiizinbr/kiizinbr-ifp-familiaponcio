import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from "class-validator";
import { TipoUnidade } from "@ifp/database";

/**
 * Criação de unidade (tenant). O `tipo` é único no schema, então só é possível
 * criar uma unidade para um tipo ainda não cadastrado (o service traduz colisão
 * em 409). `slug` é o identificador estável usado nas rotas e no RBAC.
 */
export class CriarUnidadeDto {
  @IsEnum(TipoUnidade, { message: "tipo inválido" })
  tipo!: TipoUnidade;

  @IsString()
  @MinLength(3, { message: "nome muito curto" })
  nome!: string;

  @Matches(/^[a-z0-9-]{2,40}$/, {
    message: "slug deve ser minúsculo, sem espaços (a-z, 0-9, hífen)",
  })
  slug!: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsEmail({}, { message: "e-mail inválido" })
  email?: string;
}
