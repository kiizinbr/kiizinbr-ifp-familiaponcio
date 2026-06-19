import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class EditarTurmaDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  diasHorario?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sala?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  vagasTotais?: number;
}
