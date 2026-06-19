import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from "class-validator";
import { Perfil } from "@ifp/database";

/**
 * Dados para o admin/gestor criar um usuário. A senha NÃO vem aqui: o sistema
 * gera uma senha provisória e devolve na resposta (fluxo "senha na tela", sem
 * e-mail). `unidades` são slugs ("medico", "educacional"...) — opcional para
 * perfis que não são por unidade (SUPER_ADMIN, PRESIDENCIA, SERVICO_SOCIAL).
 */
export class CriarUsuarioDto {
  @IsString()
  @MinLength(3, { message: "nome muito curto" })
  nome!: string;

  @IsEmail({}, { message: "email inválido" })
  email!: string;

  @IsOptional()
  @Matches(/^\d{11}$/, { message: "cpf deve ter 11 dígitos (só números)" })
  cpf?: string;

  @IsArray()
  @ArrayNotEmpty({ message: "informe ao menos um perfil" })
  @ArrayUnique()
  @IsEnum(Perfil, { each: true, message: "perfil inválido" })
  perfis!: Perfil[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  unidades?: string[];
}
