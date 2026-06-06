/** Nome a anunciar: nomeSocial quando preenchido (dignidade), senao nomeCompleto. */
export function nomeChamado(cidadao: { nomeSocial: string | null; nomeCompleto: string }): string {
  const social = cidadao.nomeSocial?.trim();
  return social ? social : cidadao.nomeCompleto;
}

/** Anuncio do rodape esta vigente? Sem prazo (null) = sempre; senao ativoAte no futuro. */
export function anuncioVigente(anuncio: { ativoAte: Date | null }, agora: Date): boolean {
  return anuncio.ativoAte === null || anuncio.ativoAte.getTime() > agora.getTime();
}

/** Frase falada pelo TTS: "{nome}, {destino}". */
export function fraseChamada(nome: string, destino: string): string {
  return `${nome}, ${destino}`;
}
