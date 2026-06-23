import { IsString, MaxLength, MinLength } from "class-validator";

/** Revogação de um documento médico (documento emitido é imutável; corrige-se
 *  revogando e emitindo outro). O motivo vira trilha de auditoria. */
export class RevogarDocumentoDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  motivo!: string;
}
