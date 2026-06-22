import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { PrioridadeTriagem } from "@ifp/database";

export class CriarTriagemDto {
  @IsString()
  fichaId!: string;

  @IsOptional()
  @IsEnum(PrioridadeTriagem)
  prioridade?: PrioridadeTriagem;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivoSolicitacao?: string;
}
