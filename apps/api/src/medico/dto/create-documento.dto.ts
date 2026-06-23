import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { TipoDocumentoMedico } from "@ifp/database";

/**
 * Emissão de um documento médico (atestado / receita / declaração) durante o
 * atendimento. O `conteudo` é texto livre (v1); `cid10` e `diasAfastamento` só
 * fazem sentido para ATESTADO mas são opcionais e validados em qualquer tipo.
 */
export class CreateDocumentoDto {
  @IsEnum(TipoDocumentoMedico)
  tipo!: TipoDocumentoMedico;

  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  conteudo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  cid10?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  diasAfastamento?: number;
}
