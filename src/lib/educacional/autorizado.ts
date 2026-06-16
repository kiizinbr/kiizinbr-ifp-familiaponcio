/**
 * Núcleo de segurança do check-in/out da creche — lógica PURA (não toca banco).
 * Portado de `main` `apps/api/src/educacional/rotina.service.ts:44–81`,
 * preservando a ORDEM EXATA dos bloqueios e os motivos.
 *
 * Princípio (segurança física de menores): só entrega/retira quem está na lista,
 * sem restrição judicial, não revogado e dentro da vigência. Cada bloqueio é
 * INTRANSPONÍVEL e a ordem importa — a auditoria da tentativa (no serviço) usa o
 * motivo do PRIMEIRO bloqueio que casar.
 */

/** Sentido do evento de portão. */
export type SentidoCheck = "ENTRADA" | "SAIDA";

/**
 * Subconjunto do `ResponsavelAutorizado` necessário para os 4 bloqueios. Não acopla
 * ao tipo Prisma inteiro — qualquer registro com estes campos serve (o serviço passa
 * a linha do banco, os testes passam um objeto literal). Compatível por estrutura.
 */
export interface AutorizadoCheck {
  restricaoJudicial: boolean;
  vigenteAte: Date | null;
  revogadoEm: Date | null;
}

/** Resultado de uma validação pura: ok, ou bloqueado com motivo legível. */
export interface ResultadoValidacao {
  ok: boolean;
  motivo?: string;
}

/**
 * Os 4 bloqueios de segurança, na ORDEM do `main` (cada um intransponível):
 *   (a) autorizado null/inexistente → "não está na lista de autorizados";
 *   (b) restricaoJudicial === true  → "restrição judicial vigente";
 *   (c) revogadoEm != null          → "autorização revogada";
 *   (d) vigenteAte < agora          → "autorização vencida".
 * Senão → ok. PURA: recebe o registro (ou null), o sentido e `agora`.
 *
 * `sentido` não muda a regra hoje (os 4 bloqueios valem para ENTRADA e SAIDA);
 * fica na assinatura para espelhar o `main` e permitir regras por-sentido no futuro.
 */
export function validarAutorizado(
  autorizado: AutorizadoCheck | null,
  _sentido: SentidoCheck,
  agora: Date,
): ResultadoValidacao {
  if (!autorizado) {
    return { ok: false, motivo: "pessoa não está na lista de autorizados desta criança" };
  }
  if (autorizado.restricaoJudicial) {
    return { ok: false, motivo: "restrição judicial vigente — comunique a coordenação" };
  }
  if (autorizado.revogadoEm) {
    return { ok: false, motivo: "autorização revogada pelo responsável legal" };
  }
  if (autorizado.vigenteAte && autorizado.vigenteAte < agora) {
    return { ok: false, motivo: "autorização vencida" };
  }
  return { ok: true };
}

/**
 * Estado-do-dia (puro): valida a alternância entrada/saída a partir do ÚLTIMO check
 * do dia da criança. Espelha `main` `rotina.service.ts` (checkin/checkout):
 *   - ENTRADA exige que o último NÃO seja ENTRADA (senão a criança já está presente);
 *   - SAIDA exige que o último SEJA ENTRADA (senão não há check-in aberto pra fechar).
 * `ultimoSentidoDoDia = null` significa que ainda não houve nenhum check hoje.
 */
export function proximoCheckPermitido(
  ultimoSentidoDoDia: SentidoCheck | null,
  novoSentido: SentidoCheck,
): ResultadoValidacao {
  if (novoSentido === "ENTRADA") {
    if (ultimoSentidoDoDia === "ENTRADA") {
      return { ok: false, motivo: "esta criança já está presente (check-in sem saída)" };
    }
    return { ok: true };
  }
  // novoSentido === "SAIDA"
  if (ultimoSentidoDoDia !== "ENTRADA") {
    return {
      ok: false,
      motivo: "não há check-in aberto hoje para esta criança — check-out bloqueado",
    };
  }
  return { ok: true };
}
