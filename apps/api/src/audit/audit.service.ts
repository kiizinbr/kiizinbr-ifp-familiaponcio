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

/** Resumo da última falha de gravação da trilha (sem dados sensíveis do evento). */
interface UltimaFalhaAuditoria {
  em: string; // ISO
  erro: string;
  acao: AcaoAuditoria;
  entidade: string;
}

/** Estado de saúde da gravação da trilha, exposto a SUPER_ADMIN. */
export interface SaudeAuditoria {
  saudavel: boolean;
  falhas: number;
  ultimaFalha: UltimaFalhaAuditoria | null;
}

/**
 * Camada fina sobre `AuditLog` (LGPD). Falhas de auditoria nunca bloqueiam a
 * operação principal (a gravação é fire-and-forget) — mas NÃO podem ser
 * silenciosas: cada falha incrementa um contador em memória, emite um log com a
 * tag distinta `AUDIT_FAILURE` e fica exposta via `getSaude()` (endpoint
 * `/admin/auditoria/saude-trilha`). Mitigação mínima do achado P0.3; o outbox
 * transacional fica como roadmap.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  /** Total de falhas de gravação desde o boot do processo. */
  private falhasContador = 0;
  /** Resumo da falha mais recente (para diagnóstico operacional). */
  private ultimaFalha: UltimaFalhaAuditoria | null = null;

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
      .catch((err) => this.registrarFalha(evento, err));
  }

  /**
   * Trata a falha da gravação fire-and-forget: conta, guarda o resumo e emite um
   * alerta com a tag `AUDIT_FAILURE` (distinta, para alarme/grep operacional).
   * Nunca relança — a operação principal já concluiu.
   */
  private registrarFalha(evento: RegistrarEvento, err: unknown): void {
    this.falhasContador += 1;
    const mensagem = err instanceof Error ? err.message : String(err);
    this.ultimaFalha = {
      em: new Date().toISOString(),
      erro: mensagem,
      acao: evento.acao,
      entidade: evento.entidade,
    };
    // Tag `AUDIT_FAILURE` + total acumulado: um registro de auditoria LGPD foi
    // PERDIDO. Isso precisa virar alerta operacional, não passar despercebido.
    this.logger.error(
      `AUDIT_FAILURE Falha ao gravar AuditLog (total=${this.falhasContador}) ` +
        `acao=${evento.acao} entidade=${evento.entidade}`,
      err instanceof Error ? err.stack : undefined,
    );
  }

  /** Estado de saúde da gravação da trilha (consumido pelo endpoint de governança). */
  getSaude(): SaudeAuditoria {
    return {
      saudavel: this.falhasContador === 0,
      falhas: this.falhasContador,
      ultimaFalha: this.ultimaFalha,
    };
  }
}
