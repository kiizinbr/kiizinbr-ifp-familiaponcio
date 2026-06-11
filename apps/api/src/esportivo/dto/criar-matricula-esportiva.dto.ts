import { IsOptional, IsString } from "class-validator";

export class CriarMatriculaEsportivaDto {
  @IsString()
  fichaId!: string;

  /** Atleta dependente (membro da família); ausente = titular. */
  @IsOptional()
  @IsString()
  membroId?: string;
}
