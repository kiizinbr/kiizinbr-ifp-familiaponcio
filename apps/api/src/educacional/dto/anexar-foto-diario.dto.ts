import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Campo de texto do multipart no anexo de foto ao diário (Onda C3). A foto em
 * si chega pelo FileInterceptor (não entra aqui); a `legenda` é o toque afetivo
 * opcional ("Primeira pintura a dedo!").
 */
export class AnexarFotoDiarioDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  legenda?: string;
}
