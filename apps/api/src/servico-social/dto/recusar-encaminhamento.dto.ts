import { IsString, MaxLength, MinLength } from "class-validator";

export class RecusarEncaminhamentoDto {
  // Recusar exige justificativa — fica registrada na auditoria e na timeline.
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  justificativaResposta!: string;
}
