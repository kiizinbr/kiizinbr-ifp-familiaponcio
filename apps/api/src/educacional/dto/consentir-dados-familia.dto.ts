import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";

/**
 * Consentimentos de DADOS que o titular controla no portal da família.
 * Subconjunto de TipoConsentimento — só o que a família pode dar/revogar
 * sozinha (uso de dados pessoais e compartilhamento com parceiros).
 */
export enum TipoConsentimentoFamilia {
  USO_DADOS_LGPD = "USO_DADOS_LGPD",
  COMPARTILHAMENTO_PARCEIROS = "COMPARTILHAMENTO_PARCEIROS",
}

/**
 * Ação do titular: dar/revogar consentimento sobre os DADOS da própria ficha.
 * Reusa o model Consentimento (por ficha) — não cria 2º sistema.
 */
export class ConsentirDadosFamiliaDto {
  /** Qual consentimento de dados (uso de dados LGPD ou compartilhamento). */
  @IsEnum(TipoConsentimentoFamilia)
  tipo!: TipoConsentimentoFamilia;

  /** true concede; false revoga (nova versão do registro — trilha por versaoTermo). */
  @IsBoolean()
  concedido!: boolean;

  /** Versão do termo aceito; ausente = versão vigente. */
  @IsOptional()
  @IsString()
  versaoTermo?: string;
}
