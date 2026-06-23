import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ClassificacaoRisco } from "@ifp/database";

/**
 * PUT da triagem de enfermagem (acolhimento na chegada) — substitui o conjunto
 * inteiro (campo omitido vira null). A classificação de risco é obrigatória; os
 * vitais seguem as mesmas faixas do prontuário (SinaisVitais).
 */
export class UpsertTriagemEnfermagemDto {
  @IsEnum(ClassificacaoRisco)
  classificacaoRisco!: ClassificacaoRisco;

  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(300)
  pressaoSistolica?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(200)
  pressaoDiastolica?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(250)
  frequenciaCardiaca?: number;

  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(80)
  frequenciaRespiratoria?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(30)
  @Max(45)
  temperaturaC?: number;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(100)
  saturacaoO2?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(400)
  pesoKg?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(30)
  @Max(250)
  alturaCm?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(800)
  glicemia?: number;

  /** Escala de dor 0-10 (autorrelato do paciente no acolhimento). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  dorEscala?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  queixaPrincipal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacoes?: string;
}
