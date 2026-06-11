import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { EscopoImagem } from "@ifp/database";

export class AutorizacaoImagemItemDto {
  @IsEnum(EscopoImagem)
  escopo!: EscopoImagem;

  @IsBoolean()
  concedido!: boolean;
}

export class CriarMatriculaInfantilDto {
  @IsString()
  fichaId!: string;

  /** A criança — sempre um MembroFamiliar da ficha. */
  @IsString()
  membroId!: string;

  /**
   * LGPD Art. 14: consentimento específico e destacado do responsável legal,
   * colhido no ato da matrícula. Sem `true`, a matrícula é recusada.
   */
  @IsBoolean()
  consentimentoLgpd!: boolean;

  /** Autorizações de imagem por escopo, colhidas no mesmo fluxo (ausente = tudo negado). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutorizacaoImagemItemDto)
  autorizacoesImagem?: AutorizacaoImagemItemDto[];
}
