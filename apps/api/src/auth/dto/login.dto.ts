import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail({}, { message: "email inválido" })
  email!: string;

  @IsString()
  @MinLength(8, { message: "senha deve ter pelo menos 8 caracteres" })
  senha!: string;
}
