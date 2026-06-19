import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ModalidadeCurso } from "@ifp/database";

export class AtualizarCursoDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nome?: string;

  @IsOptional()
  @IsEnum(ModalidadeCurso)
  modalidade?: ModalidadeCurso;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  cargaHorariaTotal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  presencaMinimaPct?: number;

  @IsOptional()
  @IsBoolean()
  requerModelos?: boolean;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
