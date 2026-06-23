import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { RespostaPresenca } from "@ifp/database";

/** RSVP da família a um evento da unidade — por criança da própria família. */
export class ResponderEventoDto {
  @IsString({ message: "membroId deve ser um texto." })
  @IsNotEmpty({ message: "Informe a criança (membroId)." })
  membroId!: string;

  @IsEnum(RespostaPresenca, { message: "resposta deve ser SIM ou NAO." })
  resposta!: RespostaPresenca;

  @IsOptional()
  @IsString({ message: "observacao deve ser um texto." })
  @MaxLength(280, { message: "observacao deve ter no máximo 280 caracteres." })
  observacao?: string;
}
