import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

/**
 * Correção dos dados operacionais da turma (sem mexer em identidade:
 * modalidade/código/data de início não mudam). Todos os campos opcionais —
 * só o que vier no corpo é alterado.
 */
export class EditarTurmaEsportivaDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  diasHorario?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  local?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  faixaEtariaMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  faixaEtariaMax?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  vagasTotais?: number;
}
