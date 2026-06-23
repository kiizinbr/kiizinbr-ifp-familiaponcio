import { IsBoolean } from "class-validator";

export class DefinirUnidadeAtivaDto {
  @IsBoolean()
  ativo!: boolean;
}
