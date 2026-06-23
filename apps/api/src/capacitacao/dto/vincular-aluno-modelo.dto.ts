import { IsString } from "class-validator";

export class VincularAlunoModeloDto {
  /** Matrícula do aluno designado para atender o modelo. */
  @IsString()
  matriculaId!: string;
}
