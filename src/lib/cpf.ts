/**
 * Utilitários de CPF — validação, normalização e formatação.
 *
 * Decisão §0.2 do Plano 3 (FECHADA em 2026-05-24):
 * - CPF é OBRIGATÓRIO na Ficha Cidadã
 * - Armazenado no DB como 11 dígitos (sem ponto/traço)
 * - Dígito verificador validado antes de salvar
 */

/** Remove tudo que não é dígito. Retorna string de 11 chars idealmente. */
export function normalizeCpf(input: string): string {
  return input.replace(/\D/g, "");
}

/** Formata 11 dígitos no padrão `000.000.000-00`. Retorna entrada se length != 11. */
export function formatCpf(input: string): string {
  const digits = normalizeCpf(input);
  if (digits.length !== 11) return input;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Valida CPF pelo algoritmo oficial da Receita Federal.
 * - Rejeita CPFs com todos dígitos iguais (111.111.111-11, etc) — inválidos por convenção
 * - Calcula 2 dígitos verificadores
 */
export function validateCpf(input: string): boolean {
  const cpf = normalizeCpf(input);
  if (cpf.length !== 11) return false;

  // Rejeita CPFs com todos dígitos iguais (caso especial: matemática "passa" mas RFB recusa)
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let firstCheck = 11 - (sum % 11);
  if (firstCheck >= 10) firstCheck = 0;
  if (firstCheck !== parseInt(cpf.charAt(9), 10)) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  let secondCheck = 11 - (sum % 11);
  if (secondCheck >= 10) secondCheck = 0;
  if (secondCheck !== parseInt(cpf.charAt(10), 10)) return false;

  return true;
}
