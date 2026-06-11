import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsString, ValidateNested } from "class-validator";
import { StatusPresenca } from "@ifp/database";

export class ItemChamadaTreinoDto {
  @IsString()
  matriculaId!: string;

  @IsEnum(StatusPresenca)
  status!: StatusPresenca;
}

/** Chamada do treino em lote — idempotente (upsert por atleta). */
export class LancarChamadaTreinoDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemChamadaTreinoDto)
  itens!: ItemChamadaTreinoDto[];
}
