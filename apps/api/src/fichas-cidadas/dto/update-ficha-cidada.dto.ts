import { PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

import { CreateFichaCidadaDto } from "./create-ficha-cidada.dto";

export class UpdateFichaCidadaDto extends PartialType(CreateFichaCidadaDto) {
  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
