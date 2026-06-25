import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { DocumentosService } from "./documentos.service";
import { UploadDocumentoDto } from "./dto/upload-documento.dto";

/**
 * Documentos da Ficha Cidadã (Onda C2) — dado pessoal/sensível.
 *
 * Mesmo portão de RBAC da ficha em si (SUPER_ADMIN + SERVICO_SOCIAL): só quem
 * pode ver a ficha pode anexar/listar/baixar/excluir seus documentos. Qualquer
 * outro perfil (profissional de unidade, família, recepção) cai no PerfisGuard
 * com 403 — é a parede de tenant/IDOR no nível do controller.
 */
@ApiTags("fichas-cidadas")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.SERVICO_SOCIAL)
@Controller("fichas-cidadas/:id/documentos")
export class DocumentosController {
  constructor(private readonly documentos: DocumentosService) {}

  @Post()
  @ApiOperation({ summary: "Anexa um documento à ficha (PDF/JPG/PNG, até 8 MB)" })
  @ApiParam({ name: "id", description: "cuid da ficha" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["arquivo", "tipo"],
      properties: {
        arquivo: { type: "string", format: "binary" },
        tipo: {
          type: "string",
          enum: ["RG", "CPF", "COMPROVANTE_RESIDENCIA", "COMPROVANTE_RENDA", "CADUNICO", "CARTEIRA_TRABALHO", "CERTIDAO_NASCIMENTO", "LAUDO_MEDICO", "OUTRO"],
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor("arquivo"))
  @HttpCode(HttpStatus.CREATED)
  upload(
    @Param("id") id: string,
    @Body() dto: UploadDocumentoDto,
    @UploadedFile() arquivo: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentos.upload(id, dto.tipo, arquivo, user.id);
  }

  @Get()
  @ApiOperation({ summary: "Lista os documentos da ficha (registra READ no audit)" })
  @ApiParam({ name: "id", description: "cuid da ficha" })
  listar(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentos.listar(id, user.id);
  }

  @Get(":docId")
  @ApiOperation({
    summary: "URL pré-assinada de download do documento (checa ownership/tenant)",
  })
  @ApiParam({ name: "id", description: "cuid da ficha" })
  @ApiParam({ name: "docId", description: "cuid do documento" })
  download(
    @Param("id") id: string,
    @Param("docId") docId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentos.urlDownload(id, docId, user.id);
  }

  @Delete(":docId")
  @ApiOperation({ summary: "Remove o documento do storage e da ficha" })
  @ApiParam({ name: "id", description: "cuid da ficha" })
  @ApiParam({ name: "docId", description: "cuid do documento" })
  @HttpCode(HttpStatus.OK)
  remover(
    @Param("id") id: string,
    @Param("docId") docId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentos.remover(id, docId, user.id);
  }
}
