import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { StatusElegibilidade } from "@ifp/database";

export class UpdateElegibilidadeDto {
  @IsEnum(StatusElegibilidade)
  status!: StatusElegibilidade;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motivo?: string;

  @IsOptional()
  @IsDateString()
  reavaliarEm?: string;
}
