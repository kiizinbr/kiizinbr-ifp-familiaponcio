import { execFileSync } from "node:child_process";

/**
 * Global teardown do Playwright: limpa os cidadãos criados pelos e2e
 * (prefixos "Teste E2E" / "Triagem E2E") pra não acumular lixo no banco de dev.
 *
 * Cidadao tem cascade pra Triagem→Elegibilidade, Anexo e Endereco, então deletar
 * o cidadão limpa o resto. AuditLog não tem FK (correlaciona por rootEntityId),
 * então é apagado explicitamente antes. Roda via psql no container (sem depender
 * de DATABASE_URL no processo do Playwright).
 */
const SQL = [
  `DELETE FROM "AuditLog" WHERE "rootEntityId" IN (SELECT id FROM "Cidadao" WHERE "nomeCompleto" LIKE 'Teste E2E%' OR "nomeCompleto" LIKE 'Triagem E2E%')`,
  `DELETE FROM "Cidadao" WHERE "nomeCompleto" LIKE 'Teste E2E%' OR "nomeCompleto" LIKE 'Triagem E2E%'`,
].join("; ");

export default function globalTeardown() {
  try {
    execFileSync(
      "docker",
      ["exec", "ifp_postgres_dev", "psql", "-U", "ifp", "ifp_connect", "-c", SQL],
      {
        stdio: "ignore",
      },
    );
  } catch (error) {
    // Não-fatal: cleanup é higiene, não deve quebrar o resultado dos testes.
    console.warn("[e2e teardown] limpeza de dados de teste falhou (ignorado):", error);
  }
}
