import { IsOptional, IsString } from "class-validator";

export class InscreverModeloDto {
  /** Modelo voluntário que se inscreve na sessão. */
  @IsString()
  modeloId!: string;

  /** Aluno (matrícula) já designado no ato da inscrição (opcional). */
  @IsOptional()
  @IsString()
  matriculaId?: string;
}
