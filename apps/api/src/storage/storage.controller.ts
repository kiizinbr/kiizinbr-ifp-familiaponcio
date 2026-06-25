import { Controller, Get, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { StorageService } from "./storage.service";

/**
 * Diagnóstico de storage (Onda C1) — SUPER_ADMIN apenas.
 * GET /admin/storage/health faz um round-trip real no MinIO (put+get+remove de um
 * objeto temporário) e responde {ok:true}. Se o MinIO estiver fora, devolve 503.
 */
@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN)
@Controller("admin/storage")
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get("health")
  @ApiOperation({ summary: "Round-trip put+get no MinIO (diagnóstico de storage)" })
  async health() {
    try {
      await this.storage.roundTrip();
      return { ok: true, bucket: this.storage.bucketName };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ServiceUnavailableException({ ok: false, erro: msg });
    }
  }
}
