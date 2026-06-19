import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { StatusAgendamento } from "@ifp/database";

/**
 * Gestão do agendamento pela agenda/fila: confirmar presença, marcar falta,
 * cancelar ou reagendar (data/hora). O service só aceita os status de gestão
 * (AGENDADO/CONFIRMADO/FALTOU/CANCELADO) — iniciar/concluir têm rotas próprias.
 */
export class AtualizarAgendamentoDto {
  @IsOptional()
  @IsEnum(StatusAgendamento)
  status?: StatusAgendamento;

  @IsOptional()
  @IsDateString()
  inicioEm?: string;

  @IsOptional()
  @IsDateString()
  fimEm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}
