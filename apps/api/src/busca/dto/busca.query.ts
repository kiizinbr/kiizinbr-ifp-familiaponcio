import { IsOptional, IsString, MaxLength } from "class-validator";

export class BuscaQuery {
  /** Termo livre: nome, e-mail, CPF (só dígitos) ou protocolo. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
