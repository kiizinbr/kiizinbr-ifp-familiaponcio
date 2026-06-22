import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { AtendimentosService } from "./atendimentos.service";
import { UpdateSoapDto } from "./dto/update-soap.dto";
import { UpsertVitaisDto } from "./dto/upsert-vitais.dto";
import { CreatePrescricaoDto } from "./dto/create-prescricao.dto";

@ApiTags("medico")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.PROFISSIONAL)
@Controller("medico")
export class AtendimentosController {
  constructor(private readonly atendimentos: AtendimentosService) {}

  @Patch("atendimentos/:id")
  @ApiOperation({ summary: "Salva rascunho SOAP (409 se já encerrado)" })
  @ApiParam({ name: "id", description: "cuid do atendimento" })
  salvarSoap(
    @Param("id") id: string,
    @Body() dto: UpdateSoapDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.atendimentos.salvarSoap(user, id, dto);
  }

  @Put("atendimentos/:id/vitais")
  @ApiOperation({ summary: "Substitui os sinais vitais do atendimento (upsert 1-1)" })
  @ApiParam({ name: "id", description: "cuid do atendimento" })
  @HttpCode(HttpStatus.OK)
  upsertVitais(
    @Param("id") id: string,
    @Body() dto: UpsertVitaisDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.atendimentos.upsertVitais(user, id, dto);
  }

  @Post("atendimentos/:id/encerrar")
  @ApiOperation({
    summary: "Sela o atendimento (exige S e P; prontuário fica imutável) e conclui o agendamento",
  })
  @ApiParam({ name: "id", description: "cuid do atendimento" })
  @HttpCode(HttpStatus.OK)
  encerrar(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.atendimentos.encerrar(user, id);
  }

  @Post("atendimentos/:id/prescricoes")
  @ApiOperation({
    summary:
      "Emite prescrição. Bloqueia (409 ALERGIA_CONFLITO) se houver medicamento que casa com alergia ATIVA do paciente sem override.motivo.",
  })
  @ApiParam({ name: "id", description: "cuid do atendimento" })
  @HttpCode(HttpStatus.CREATED)
  prescrever(
    @Param("id") id: string,
    @Body() dto: CreatePrescricaoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.atendimentos.prescrever(user, id, dto);
  }
}
