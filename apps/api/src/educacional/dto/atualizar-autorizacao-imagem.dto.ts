import { IsBoolean, IsOptional, IsString } from "class-validator";

export class AtualizarAutorizacaoImagemDto {
  /** true concede; false revoga (efeito imediato, nunca deleta — trilha). */
  @IsBoolean()
  concedido!: boolean;

  /** Versão do termo assinado; ausente = versão vigente. */
  @IsOptional()
  @IsString()
  versaoTermo?: string;
}
