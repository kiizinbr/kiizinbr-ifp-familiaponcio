import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class CriarMensagemDto {
  /** Corpo da mensagem — trim obrigatório, 1..2000 caracteres. */
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString({ message: "O corpo da mensagem deve ser um texto." })
  @IsNotEmpty({ message: "A mensagem não pode ser vazia." })
  @MinLength(1, { message: "A mensagem não pode ser vazia." })
  @MaxLength(2000, { message: "A mensagem deve ter no máximo 2000 caracteres." })
  corpo!: string;
}
