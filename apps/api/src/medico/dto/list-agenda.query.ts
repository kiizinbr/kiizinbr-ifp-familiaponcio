import { IsDateString, IsOptional } from "class-validator";

export class ListAgendaQuery {
  /** Dia da agenda (YYYY-MM-DD). Default: hoje. */
  @IsOptional()
  @IsDateString()
  data?: string;
}
