import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { OdontogramaService } from "./odontograma.service";
import { UpsertOdontogramaDto } from "./dto/upsert-odontograma.dto";

@ApiTags("medico")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.PROFISSIONAL)
@Controller("medico")
export class OdontogramaController {
  constructor(private readonly odontograma: OdontogramaService) {}

  @Get("atendimentos/:id/odontograma")
  @ApiOperation({ summary: "Lê o odontograma do atendimento (404 se ainda não existe)" })
  @ApiParam({ name: "id", description: "cuid do atendimento" })
  ler(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.odontograma.ler(user, id);
  }

  @Put("atendimentos/:id/odontograma")
  @ApiOperation({
    summary: "Cria/atualiza o odontograma do atendimento (FDI 32 dentes + plano). 409 se selado.",
  })
  @ApiParam({ name: "id", description: "cuid do atendimento" })
  @HttpCode(HttpStatus.OK)
  upsert(
    @Param("id") id: string,
    @Body() dto: UpsertOdontogramaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.odontograma.upsert(user, id, dto);
  }
}
