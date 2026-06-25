import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { PinoLogger } from "nestjs-pino";
import type { Request, Response } from "express";

/**
 * Filtro de exceções GLOBAL.
 *
 * Objetivo (P1.8): padronizar a resposta de erro SEM vazar PII/stack ao cliente
 * e registrar o erro de forma estruturada no servidor (o pino já redata campos
 * sensíveis — ver LoggerModule no app.module).
 *
 * Contrato preservado de propósito:
 * - Para HttpException (todos os 4xx/503 já testados): repassa status e corpo
 *   EXATAMENTE como o Nest faz por padrão (`getResponse()`), então os contratos
 *   com `code`/`conflitos`/`message` (ALERGIA_CONFLITO, CONSENTIMENTO_NECESSARIO,
 *   validações do ValidationPipe, RBAC 403/404 etc.) continuam idênticos.
 * - Para erro NÃO-HTTP (bug → 500): devolve um corpo genérico fixo, sem stack
 *   nem a mensagem original (que poderia conter PII), e loga o erro completo
 *   só no servidor.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext("AllExceptionsFilter");
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      // Repassa o corpo EXATO do Nest — não altera contratos de erro existentes.
      const body = exception.getResponse();

      // Erros do cliente (4xx) são esperados: log em nível de aviso, sem stack,
      // só com o necessário para diagnóstico. O pino redata campos sensíveis.
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(
          { err: exception, method: request?.method, url: request?.url, status },
          "Exceção HTTP de servidor",
        );
      } else {
        this.logger.warn(
          { method: request?.method, url: request?.url, status },
          "Exceção HTTP de cliente",
        );
      }

      httpAdapter.reply(response, body, status);
      return;
    }

    // Qualquer outra coisa = bug não tratado → 500 genérico, SEM vazar nada.
    // O erro completo (com stack) vai SÓ para o log do servidor, já redatado.
    this.logger.error(
      { err: exception, method: request?.method, url: request?.url },
      "Exceção não tratada (500)",
    );

    httpAdapter.reply(
      response,
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Erro interno do servidor",
        error: "Internal Server Error",
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
