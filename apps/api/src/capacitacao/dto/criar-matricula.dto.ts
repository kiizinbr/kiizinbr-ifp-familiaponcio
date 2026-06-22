import { IsBoolean, IsOptional, IsString } from "class-validator";

export class CriarMatriculaDto {
  @IsString()
  fichaId!: string;

  /** Aluno dependente (membro da família); ausente = titular. */
  @IsOptional()
  @IsString()
  membroId?: string;

  /**
   * Consentimento do responsável (titular). OBRIGATÓRIO para matricular menor
   * de 18 anos — o servidor barra a matrícula de menor sem este flag (LGPD).
   */
  @IsOptional()
  @IsBoolean()
  consentimentoTitular?: boolean;
}
