/**
 * Regras de troca de senha (compartilhadas pelo reset por token e pela troca
 * forçada no 1º login). Puro/testável.
 */
export const SENHA_MIN = 8;

/** Retorna a mensagem de erro, ou null se a nova senha é válida. */
export function validarTrocaSenha(senha: string, confirma: string): string | null {
  if (senha.length < SENHA_MIN) return `A senha deve ter ao menos ${SENHA_MIN} caracteres.`;
  if (senha !== confirma) return "As senhas não conferem.";
  return null;
}
