import { EscopoImagem } from "@ifp/database";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";

/**
 * Ação do titular no portal da família: dar/revogar consentimento de uso de
 * imagem da própria criança. Reusa o model AutorizacaoImagem (por menor).
 */
export class ConsentirImagemFamiliaDto {
  /** Onde a imagem da criança pode aparecer (USO_INTERNO, REDES_IFP, IMPRENSA). */
  @IsEnum(EscopoImagem)
  escopo!: EscopoImagem;

  /** true concede; false revoga (efeito imediato, nunca deleta — trilha LGPD). */
  @IsBoolean()
  concedido!: boolean;

  /** Versão do termo aceito; ausente = versão vigente. */
  @IsOptional()
  @IsString()
  versaoTermo?: string;
}
