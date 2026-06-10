import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

/** PUT de sinais vitais — substitui o conjunto inteiro (campo omitido vira null). */
export class UpsertVitaisDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  queixaPrincipal?: string;
}
