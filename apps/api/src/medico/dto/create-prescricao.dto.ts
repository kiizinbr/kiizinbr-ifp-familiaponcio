import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

/** Um item da prescrição: medicamento + posologia (nomes livres na v1). */
export class PrescricaoItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  medicamento!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  posologia!: string;
}

/** Override consciente: só presente quando o médico decide prescrever
 *  APESAR de um conflito de alergia. O motivo vira trilha de auditoria. */
export class OverrideAlergiaDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  motivo!: string;
}

export class CreatePrescricaoDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PrescricaoItemDto)
  itens!: PrescricaoItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OverrideAlergiaDto)
  override?: OverrideAlergiaDto;
}
