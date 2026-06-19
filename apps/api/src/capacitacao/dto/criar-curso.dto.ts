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

export class CriarCursoDto {
  @IsString()
  @MinLength(2, { message: "nome muito curto" })
  @MaxLength(80)
  nome!: string;

  @IsEnum(ModalidadeCurso, { message: "modalidade inválida (PRATICO ou TEORICO)" })
  modalidade!: ModalidadeCurso;

  @IsInt()
  @Min(1)
  @Max(2000)
  cargaHorariaTotal!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  presencaMinimaPct?: number;

  @IsOptional()
  @IsBoolean()
  requerModelos?: boolean;
}
