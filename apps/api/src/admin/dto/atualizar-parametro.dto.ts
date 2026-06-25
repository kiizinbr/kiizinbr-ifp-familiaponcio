import { IsDefined } from "class-validator";

/**
 * Atualiza um parâmetro simples da plataforma. O `valor` é validado por tipo
 * NO SERVICE, contra o catálogo (whitelist) — aqui só garantimos que veio algo
 * (boolean/number/string são todos aceitos pelo class-validator com IsDefined).
 */
export class AtualizarParametroDto {
  @IsDefined({ message: "informe o valor" })
  valor!: boolean | number | string;
}
