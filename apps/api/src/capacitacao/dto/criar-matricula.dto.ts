import { IsOptional, IsString } from "class-validator";

export class CriarMatriculaDto {
  @IsString()
  fichaId!: string;

  /** Aluno dependente (membro da família); ausente = titular. */
  @IsOptional()
  @IsString()
  membroId?: string;
}
