import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { SituacaoMoradia } from "@ifp/database";

export class UpsertDadosSocioDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rendaFamiliarTotal!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rendaPerCapita!: number;

  @IsOptional()
  @IsBoolean()
  recebeBolsaFamilia?: boolean;

  @IsOptional()
  @IsBoolean()
  recebeBPC?: boolean;

  @IsOptional()
  @IsBoolean()
  recebeAuxilioGas?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  outrosBeneficios?: string;

  @IsEnum(SituacaoMoradia)
  situacaoMoradia!: SituacaoMoradia;

  @IsInt()
  @Min(1)
  numeroPessoasMoradia!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  numeroComodos?: number;

  @IsOptional()
  @IsBoolean()
  temAguaEncanada?: boolean;

  @IsOptional()
  @IsBoolean()
  temEsgoto?: boolean;

  @IsOptional()
  @IsBoolean()
  temEnergiaEletrica?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  vulnerabilidades?: string;
}
