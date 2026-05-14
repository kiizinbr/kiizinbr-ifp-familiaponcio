import { Injectable, Logger } from "@nestjs/common";
import { AcaoAuditoria, type Prisma } from "@ifp/database";

import { PrismaService } from "../prisma/prisma.service";

interface RegistrarEvento {
  userId?: string | null;
  acao: AcaoAuditoria;
  entidade: string;
  entidadeId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadados?: Prisma.InputJsonValue;
}

/**
 * Camada fina sobre `AuditLog` (LGPD). Falhas de auditoria nunca bloqueiam
 * a operação principal — só geram log no console.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  registrar(evento: RegistrarEvento): void {
    this.prisma.auditLog
      .create({
        data: {
          userId: evento.userId ?? null,
          acao: evento.acao,
          entidade: evento.entidade,
          entidadeId: evento.entidadeId ?? null,
          ip: evento.ip ?? null,
          userAgent: evento.userAgent ?? null,
          metadados: evento.metadados,
        },
      })
      .catch((err) => this.logger.error("Falha ao gravar AuditLog", err));
  }
}
