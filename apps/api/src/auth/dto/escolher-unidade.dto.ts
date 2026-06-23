import { IsString } from "class-validator";

/**
 * Seletor de unidade pós-login. O usuário só informa o cuid da unidade que
 * quer ativar; o backend valida que ela é UMA DAS SUAS (senão 404 anti-enum).
 */
export class EscolherUnidadeDto {
  @IsString()
  unidadeId!: string;
}
