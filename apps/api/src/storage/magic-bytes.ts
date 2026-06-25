import { UnsupportedMediaTypeException } from "@nestjs/common";

/**
 * Validação de tipo de arquivo por MAGIC BYTES (P1.4).
 *
 * Por que: o `Content-Type` do multipart é fornecido pelo CLIENTE e pode mentir
 * — um HTML/exe disfarçado de "image/jpeg" passaria numa checagem que só olha o
 * cabeçalho. Como o download serve o arquivo por URL pré-assinada, um HTML
 * disfarçado vira vetor de XSS. Aqui inspecionamos os PRIMEIROS BYTES do
 * conteúdo (a assinatura real do formato) e ignoramos o que o cliente declarou.
 *
 * `file-type@20` é ESM-puro (`"type": "module"`, sem export CommonJS). A API
 * compila para CommonJS, então um `import` estático viraria `require()` e
 * quebraria em runtime (ERR_REQUIRE_ESM). A solução é um `import()` DINÂMICO de
 * verdade — mas o TypeScript, com `module: CommonJS`, reescreve `import()` para
 * `require()` no output, reintroduzindo o bug. Para FORÇAR um import dinâmico
 * nativo (que o Node 18+ resolve para o ESM), usamos `new Function(...)`: o
 * compilador não enxerga o `import()` ali dentro e o deixa intacto em runtime.
 */

/** Subconjunto do `file-type` que usamos (tipado à mão por causa do import via Function). */
type FileTypeModulo = {
  fileTypeFromBuffer: (
    buffer: Uint8Array,
  ) => Promise<{ ext: string; mime: string } | undefined>;
};

/** Import dinâmico NATIVO (escondido do `tsc` p/ não virar `require` do ESM-puro). */
const importDinamico = new Function(
  "especificador",
  "return import(especificador);",
) as (especificador: string) => Promise<FileTypeModulo>;

/** Resultado da validação: a extensão canônica derivada do MIME DETECTADO. */
export interface TipoDetectado {
  /** MIME real, conforme os magic bytes (ex.: "image/png"). */
  mime: string;
  /** Extensão da allowlist correspondente ao MIME detectado (ex.: "png"). */
  ext: string;
}

/**
 * Valida o conteúdo contra uma allowlist `{ mime -> extensão }` usando magic
 * bytes. Lança `UnsupportedMediaTypeException` se o tipo real não estiver na
 * allowlist (inclui o caso de tipo NÃO reconhecido — texto puro, p.ex.).
 *
 * Retorna o MIME detectado e a extensão da allowlist — quem chama deve usar
 * ESTES valores (não o `Content-Type` do cliente) para nomear/guardar o objeto.
 */
export async function validarTipoPorConteudo(
  buffer: Buffer,
  mimesPermitidos: Record<string, string>,
  mensagemErro: string,
): Promise<TipoDetectado> {
  // import() dinâmico NATIVO: única via de consumir o ESM-puro a partir de CommonJS.
  const { fileTypeFromBuffer } = await importDinamico("file-type");

  // O `file-type` pode LANÇAR (EndOfStream) em buffers minúsculos/truncados —
  // que são entrada inválida de qualquer forma. Tratamos como "não detectado"
  // e caímos no 415 (fail-closed: na dúvida, recusa; nunca aceita por engano).
  let detectado: { mime: string } | undefined;
  try {
    detectado = await fileTypeFromBuffer(buffer);
  } catch {
    detectado = undefined;
  }

  // Tipo não reconhecido (texto puro, vazio, etc.) → fora da allowlist.
  const ext = detectado ? mimesPermitidos[detectado.mime] : undefined;
  if (!detectado || !ext) {
    throw new UnsupportedMediaTypeException(mensagemErro);
  }

  return { mime: detectado.mime, ext };
}
