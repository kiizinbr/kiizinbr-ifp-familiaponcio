import { IsEnum, IsString, MinLength } from "class-validator";
import { TipoRegistroRotina } from "@ifp/database";

export class CriarRegistroRotinaDto {
  @IsEnum(TipoRegistroRotina)
  tipo!: TipoRegistroRotina;

  /** Texto curto, alimentado pelas tags de 1 toque (meta 5–10s por lançamento). */
  @IsString()
  @MinLength(2)
  descricao!: string;
}
