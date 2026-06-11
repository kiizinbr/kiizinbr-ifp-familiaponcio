import { IsInt, IsString, Max, Min, MinLength } from "class-validator";

export class CriarTurmaInfantilDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  /** Faixa etária em meses (ex.: 48–72 = Jardim). */
  @IsInt()
  @Min(0)
  @Max(120)
  faixaEtariaMin!: number;

  @IsInt()
  @Min(1)
  @Max(144)
  faixaEtariaMax!: number;

  @IsInt()
  @Min(1)
  @Max(40)
  capacidade!: number;
}
