import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import { RespostaPresenca } from "@ifp/database";

/**
 * Confirmação "vem amanhã?" da creche — SIM/NAO da criança num dia civil.
 * `data` é opcional (default = amanhã no fuso de SP); quando vier, AAAA-MM-DD.
 */
export class ResponderPresencaDto {
  @IsString({ message: "membroId deve ser um texto." })
  @IsNotEmpty({ message: "Informe a criança (membroId)." })
  membroId!: string;

  @IsEnum(RespostaPresenca, { message: "resposta deve ser SIM ou NAO." })
  resposta!: RespostaPresenca;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "data deve estar no formato AAAA-MM-DD." })
  data?: string;

  @IsOptional()
  @IsString({ message: "observacao deve ser um texto." })
  @MaxLength(280, { message: "observacao deve ter no máximo 280 caracteres." })
  observacao?: string;
}
