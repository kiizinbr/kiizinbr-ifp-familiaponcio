import { IsOptional, IsString, MaxLength } from "class-validator";

/** Rascunho do prontuário SOAP — todos os campos opcionais (salvamento parcial). */
export class UpdateSoapDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  subjetivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  objetivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  avaliacao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  plano?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  cid10?: string;
}
