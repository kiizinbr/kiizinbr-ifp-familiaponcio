import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { Escolaridade, Parentesco } from "@ifp/database";

export class MembroFamiliarDto {
  @IsString()
  @MaxLength(120)
  nomeCompleto!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: "cpf deve conter 11 dígitos" })
  cpf?: string;

  @IsDateString()
  dataNascimento!: string;

  @IsEnum(Parentesco)
  parentesco!: Parentesco;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ocupacao?: string;

  @IsOptional()
  @IsEnum(Escolaridade)
  escolaridade?: Escolaridade;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rendaMensal?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;
}

export class ReplaceMembrosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MembroFamiliarDto)
  membros!: MembroFamiliarDto[];
}
