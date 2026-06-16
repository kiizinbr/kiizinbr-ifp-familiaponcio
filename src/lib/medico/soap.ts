/**
 * SOAP da nota de evolução (#18) — módulo PURO (sem banco, sem zod, sem React).
 *
 * DECISÃO CENTRAL: o campo `notaEvolucao.texto` continua sendo a ÚNICA fonte de
 * verdade (SEM schema, SEM migration). As 4 seções SOAP (Subjetivo / Objetivo /
 * Avaliação / Plano) são um VERNIZ de edição/leitura por cima do MESMO `texto`.
 * Este módulo só (de)serializa string ↔ seções — quem persiste é o servidor, que
 * continua recebendo UM `name="texto"` e NUNCA inspeciona o conteúdo. Logo o
 * contrato da action, o autosave (Batch A) e a assinatura/imutabilidade ficam
 * intactos byte-a-byte.
 *
 * FORMATO (delimitadores, não JSON): cabeçalhos de linha estáveis dentro do
 * próprio texto, p.ex.:
 *
 *   ## Subjetivo
 *   <conteúdo livre, multilinha>
 *   ## Objetivo
 *   ...
 *   ## Avaliação
 *   ...
 *   ## Plano
 *   ...
 *
 * Por que delimitadores e não JSON: `texto` já é renderizado pre-wrap no readonly
 * e nos timelines; "## Subjetivo" continua legível cru se algum consumidor
 * (PDF/export/nota aberta em outro lugar) não parsear. `##` casa com a convenção
 * do repo (o modelo SOAP em modelos-evolucao.ts já usa S/O/A/P).
 *
 * REGRAS:
 *  (a) marcador = linha que casa /^##\s*(Subjetivo|Objetivo|Avaliacao|Plano)\s*$/i
 *      (acento normalizado na detecção; alias "Conduta" → Plano só na LEITURA;
 *      a ESCRITA é SEMPRE canônica: "## Subjetivo / ## Objetivo / ## Avaliação /
 *      ## Plano").
 *  (b) preâmbulo (texto antes do 1º marcador) → anexado ao Subjetivo (nunca se
 *      perde).
 *  (c) seção vazia NÃO emite cabeçalho; 4 seções vazias → "" (que a action
 *      converte em null, idêntico ao comportamento atual).
 */

export type SecoesSoap = {
  s: string;
  o: string;
  a: string;
  p: string;
};

export type ParseSoapResult =
  | ({ modo: "soap"; livre: "" } & SecoesSoap)
  | ({ modo: "livre"; livre: string } & SecoesSoap);

/** Rótulos canônicos exibidos/escritos por seção (com acento). */
export const SOAP_LABELS: Record<keyof SecoesSoap, string> = {
  s: "Subjetivo",
  o: "Objetivo",
  a: "Avaliação",
  p: "Plano",
};

/** Ordem fixa de serialização/leitura. */
export const SOAP_ORDEM: (keyof SecoesSoap)[] = ["s", "o", "a", "p"];

/** Remove acentos p/ casar o marcador independente de "Avaliação"/"Avaliacao". */
function semAcento(s: string): string {
  // \p{Diacritic} (com flag u) remove as marcas combinantes geradas pelo NFD sem
  // embutir caracteres combinantes crus no fonte (frágeis a re-encode/format).
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Mapa de palavra-de-cabeçalho (já SEM acento, minúscula) → seção. Inclui o alias
 * de LEITURA "conduta" → Plano (na escrita o "## Plano" é sempre canônico).
 */
const CABECALHO_PARA_SECAO: Record<string, keyof SecoesSoap> = {
  subjetivo: "s",
  objetivo: "o",
  avaliacao: "a",
  plano: "p",
  conduta: "p",
};

/**
 * Se a linha é um marcador SOAP (`## Subjetivo`, `##Avaliação`, `## conduta`…),
 * retorna a seção correspondente; senão `null`. Tolerante a espaços e ao acento.
 */
function secaoDoMarcador(linha: string): keyof SecoesSoap | null {
  const m = /^##\s*(.+?)\s*$/.exec(linha);
  if (!m) return null;
  const chave = semAcento(m[1] ?? "")
    .trim()
    .toLowerCase();
  return CABECALHO_PARA_SECAO[chave] ?? null;
}

/**
 * Detecta o modo e separa as 4 seções a partir do `texto` cru.
 *
 * - ≥1 marcador reconhecido → modo "soap" (s/o/a/p preenchidas conforme o texto;
 *   `livre` = "").
 * - nenhum marcador → modo "livre" (`livre` = texto original intacto; s/o/a/p
 *   vazias). É o caminho das ~94k notas legadas da Amplimed (texto puro/HTML cru):
 *   render idêntico ao atual.
 *
 * Preâmbulo antes do 1º marcador é anexado ao Subjetivo (nunca se perde). Cada
 * seção preserva quebras de linha internas; só o \n imediatamente após o
 * cabeçalho e o \n final de cada bloco são aparados.
 */
export function parseSoap(texto: string | null | undefined): ParseSoapResult {
  const cru = texto ?? "";
  const linhas = cru.split("\n");

  // 1ª passada: a nota é SOAP-estruturada? Heurística ENDURECIDA p/ reduzir
  // falso-positivo de nota LEGADA que por acaso contenha uma linha tipo
  // "## Subjetivo" no meio do texto (e seria mislabelada/reordenada visualmente).
  // Só tratamos como SOAP quando há SINAL FORTE de que foi o editor que gerou:
  //   (a) ≥2 marcadores canônicos DISTINTOS (s/o/a/p), OU
  //   (b) um marcador logo na 1ª linha.
  // O editor SEMPRE escreve ≥1 cabeçalho no TOPO (serializeSoap emite o 1º bloco
  // na linha 0), então toda nota gerada por ele continua caindo em (b) — zero
  // regressão. Caso contrário é nota livre/legada: devolve intacta (sem perda;
  // já era o caso — só reduz o falso-positivo).
  const secoesVistas = new Set<keyof SecoesSoap>();
  for (const l of linhas) {
    const secao = secaoDoMarcador(l);
    if (secao) secoesVistas.add(secao);
  }
  const primeiraEhMarcador = secaoDoMarcador(linhas[0] ?? "") !== null;
  const ehSoap = secoesVistas.size >= 2 || primeiraEhMarcador;
  if (!ehSoap) {
    return { modo: "livre", livre: cru, s: "", o: "", a: "", p: "" };
  }

  const acc: SecoesSoap = { s: "", o: "", a: "", p: "" };
  // Preâmbulo (antes do 1º marcador) começa indo pro Subjetivo.
  let atual: keyof SecoesSoap = "s";
  const buffers: Record<keyof SecoesSoap, string[]> = { s: [], o: [], a: [], p: [] };

  for (const linha of linhas) {
    const secao = secaoDoMarcador(linha);
    if (secao) {
      atual = secao;
      continue; // o cabeçalho em si não entra no conteúdo
    }
    buffers[atual].push(linha);
  }

  for (const chave of SOAP_ORDEM) {
    // Apara \n de borda preservando o miolo (inclusive linhas em branco internas).
    acc[chave] = buffers[chave].join("\n").replace(/^\n+/, "").replace(/\s+$/, "");
  }

  return { modo: "soap", livre: "", ...acc };
}

/**
 * Serializa as 4 seções de volta no formato delimitado. Emite SÓ as seções
 * não-vazias (após trim), na ordem canônica S→O→A→P, com cabeçalho acentuado e
 * blocos separados por linha em branco. Tudo vazio → "" (a action vira null,
 * igual ao atual). Inverso de parseSoap para qualquer entrada SOAP — round-trip
 * estável (ver tests/unit/medico-soap.test.ts).
 */
export function serializeSoap(secoes: SecoesSoap): string {
  const blocos: string[] = [];
  for (const chave of SOAP_ORDEM) {
    const conteudo = (secoes[chave] ?? "").trim();
    if (conteudo === "") continue;
    blocos.push(`## ${SOAP_LABELS[chave]}\n${conteudo}`);
  }
  return blocos.join("\n\n");
}
