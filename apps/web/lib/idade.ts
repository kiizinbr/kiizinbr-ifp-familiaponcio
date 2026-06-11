/**
 * Idade em anos completos, por calendário — a divisão por 365.25 errava no
 * dia do aniversário e em anos bissextos. `dataNascimento` é date-only do
 * Postgres (meia-noite UTC), por isso a leitura usa getters UTC; "hoje" usa
 * o relógio local do navegador (Brasil).
 */
export function idade(dataNascimento: string): number {
  const nasc = new Date(dataNascimento);
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getUTCFullYear();
  const mes = hoje.getMonth() - nasc.getUTCMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getUTCDate())) {
    anos--;
  }
  return anos;
}
