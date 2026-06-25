import type { Params } from "nestjs-pino";

/**
 * Configuração do logger estruturado (P1.8).
 *
 * - Saída JSON estruturada (sem pino-pretty: zero worker thread, boot seguro a
 *   partir de `dist/` em prod/CI; em dev o JSON também é legível o suficiente).
 * - `redact`: censura campos sensíveis em QUALQUER profundidade do objeto logado
 *   (corpo de requisição, erro serializado, headers etc.) para não vazar PII em
 *   logs — especialmente em log de erro 500.
 * - `autoLogging` exclui o /health para não poluir o log com o probe.
 */

// Campos a redatar. O pino exige paths exatos OU wildcard de UM nível (`*.campo`
// pega só objetos no 1º nível). Para cobrir profundidade arbitrária, listamos o
// campo na raiz, no nível de wildcard e nos contêineres comuns (req.body, err).
const CAMPOS_SENSIVEIS = [
  "senha",
  "senhaAtual",
  "novaSenha",
  "senhaProvisoria",
  "password",
  "cpf",
  "token",
  "accessToken",
  "refreshToken",
  "prontuario",
  "authorization",
];

// Gera os paths de redação para a raiz e para os contêineres mais comuns onde
// pino-http aninha os dados (req.body, req.headers, err).
function pathsDeRedacao(campos: string[]): string[] {
  const containers = ["", "*.", "req.body.", "req.headers.", "err."];
  const paths = new Set<string>();
  for (const campo of campos) {
    for (const c of containers) {
      paths.add(`${c}${campo}`);
    }
  }
  // headers HTTP padrão (case dos cabeçalhos reais do express é minúsculo)
  paths.add("req.headers.authorization");
  paths.add('req.headers["set-cookie"]');
  paths.add("req.headers.cookie");
  return [...paths];
}

export function loggerConfig(): Params {
  const isProd = process.env.NODE_ENV === "production";
  return {
    pinoHttp: {
      name: "ifp-api",
      level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
      redact: {
        paths: pathsDeRedacao(CAMPOS_SENSIVEIS),
        censor: "[REDACTED]",
      },
      // Não loga automaticamente o probe de saúde (ruído).
      autoLogging: {
        ignore: (req) => req.url === "/api/v1/health" || req.url === "/health",
      },
    },
  };
}
