import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

/**
 * Edição de unidade. `tipo` e `slug` NÃO são editáveis aqui: são identificadores
 * estáveis usados no RBAC, em rotas e no seed — trocá-los quebraria vínculos.
 */
export class EditarUnidadeDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: "nome muito curto" })
  nome?: string;

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
