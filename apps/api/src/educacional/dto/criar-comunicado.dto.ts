import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CriarComunicadoDto {
  @IsString()
  @MinLength(3)
  titulo!: string;

  @IsString()
  @MinLength(3)
  corpo!: string;

  /** Crítico exige confirmação de leitura do responsável. */
  @IsOptional()
  @IsBoolean()
  critico?: boolean;

  /** Turma específica; ausente = geral da unidade. */
  @IsOptional()
  @IsString()
  turmaId?: string;
}
