import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsString, ValidateNested } from "class-validator";
import { StatusPresenca } from "@ifp/database";

export class ItemChamadaDto {
  @IsString()
  matriculaId!: string;

  @IsEnum(StatusPresenca)
  status!: StatusPresenca;
}

/** Chamada em lote — idempotente (upsert por aluno). */
export class LancarChamadaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemChamadaDto)
  itens!: ItemChamadaDto[];
}
