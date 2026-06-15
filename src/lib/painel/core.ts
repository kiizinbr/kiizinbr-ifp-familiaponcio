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

/** Destinos fixos (nao-profissional) aceitos numa chamada. */
export const DESTINOS_FIXOS = ["Recepcao", "Triagem"] as const;

/** O destino e um dos fixos? (allowlist server-side; profissional e checado no banco). */
export function destinoFixoValido(destino: string): boolean {
  return (DESTINOS_FIXOS as readonly string[]).includes(destino);
}

/**
 * Extrai o videoId de varias formas de URL do YouTube (fonte unica: usada no save
 * E no player da TV, pra nao aceitar no save algo que o player rejeita).
 */
export function extrairYoutubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1]! : null;
}
