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

/**
 * Troca de senha PELO PRÓPRIO usuário. Fora do 1º acesso (forçado), exige provar
 * a senha atual — senão uma sessão roubada (XSS/estação aberta) viraria takeover
 * permanente. No fluxo forçado (mustChangePassword) não há senha atual a provar.
 * `senhaAtualConfere` é o resultado do bcrypt.compare feito na action.
 */
export function validarTrocaSenhaVoluntaria(opts: {
  forcado: boolean;
  senhaAtualConfere: boolean;
  novaSenha: string;
  confirma: string;
}): string | null {
  if (!opts.forcado && !opts.senhaAtualConfere) return "Senha atual incorreta.";
  return validarTrocaSenha(opts.novaSenha, opts.confirma);
}
