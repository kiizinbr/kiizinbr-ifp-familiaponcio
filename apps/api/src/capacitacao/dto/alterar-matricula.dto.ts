import { IsEnum } from "class-validator";
import { StatusMatricula } from "@ifp/database";

export class AlterarMatriculaDto {
  /** Apenas ATIVA (reativar), TRANCADA ou CANCELADA são aceitos pelo service. */
  @IsEnum(StatusMatricula)
  status!: StatusMatricula;
}
