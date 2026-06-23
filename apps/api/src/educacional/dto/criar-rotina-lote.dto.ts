import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { TipoRegistroRotina } from "@ifp/database";

/**
 * Lançamento de rotina para a TURMA INTEIRA de uma vez (ex.: "almoço servido"
 * para todos). Cria/usa o diário do dia de cada criança matriculada e adiciona
 * UM registro do mesmo tipo/descrição em cada um. Diário FECHADO é pulado
 * (imutável após o selo), nunca derruba o lote inteiro.
 */
export class CriarRotinaLoteDto {
  @IsEnum(TipoRegistroRotina)
  tipo!: TipoRegistroRotina;

  /** Texto curto, alimentado pelas tags de 1 toque (meta 5–10s por lançamento). */
  @IsString()
  @MinLength(2)
  descricao!: string;

  /**
   * Restringe o lote a estas crianças (membroIds) da turma. Ausente/vazio =
   * todas as matrículas ativas. Útil quando uma criança faltou ou já tem o
   * registro próprio.
   */
  @IsOptional()
  @IsString({ each: true })
  membroIds?: string[];
}
