import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { GravidadeAlergia } from "@ifp/database";

export class RegistrarAlergiaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  descricao!: string;

  @IsOptional()
  @IsEnum(GravidadeAlergia, { message: "gravidade: LEVE, MODERADA ou GRAVE" })
  gravidade?: GravidadeAlergia;

  /** Dependente; ausente = titular da ficha. */
  @IsOptional()
  @IsString()
  membroId?: string;
}

export class AtualizarAlergiaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  descricao?: string;

  @IsOptional()
  @IsEnum(GravidadeAlergia)
  gravidade?: GravidadeAlergia;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
