import { IsEnum, IsIn, IsOptional } from "class-validator";
import { TipoRelatorio } from "@ifp/database";

/**
 * Solicitação de geração de um relatório institucional selado.
 * `tipo` define o conteúdo (prestação de contas ou impacto); `periodo` segue
 * as mesmas chaves da prestação de contas. Ambos opcionais (defaults seguros).
 */
export class GerarRelatorioDto {
  @IsOptional()
  @IsEnum(TipoRelatorio, {
    message: "tipo deve ser PRESTACAO_CONTAS ou IMPACTO.",
  })
  tipo?: TipoRelatorio;

  @IsOptional()
  @IsIn(["mes", "ano", "12m"], { message: "periodo deve ser mes, ano ou 12m." })
  periodo?: string;
}
