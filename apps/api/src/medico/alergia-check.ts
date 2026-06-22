/**
 * Núcleo de SEGURANÇA DO PACIENTE para a prescrição médica: cruza os
 * medicamentos prescritos com as ALERGIAS ATIVAS da ficha e devolve os
 * conflitos encontrados.
 *
 * É uma função PURA — sem Prisma, sem Nest — de propósito:
 *  1. testável sem banco (ver alergia-check.spec.ts);
 *  2. reusável como FONTE DA VERDADE no endpoint (checagem server-side,
 *     nunca confiando no front) e, se quiser, numa pré-checagem no front.
 *
 * A política (BLOQUEAR x permitir com override justificado) NÃO mora aqui —
 * mora na camada de serviço. Ver docs/PLANO-PRESCRICAO-ALERGIA.md.
 *
 * Casamento conservador (prioriza SENSIBILIDADE — na dúvida, ALERTA):
 *  - normaliza: minúsculas, sem acento, pontuação -> espaço;
 *  - casa quando um token da alergia é igual a um token do medicamento OU
 *    (termos com >= 5 letras) aparece como raiz dentro de um token do
 *    medicamento ("sulfa" em "sulfametoxazol", "dipirona" em "dipirona 500mg").
 *
 * LIMITAÇÕES CONHECIDAS (ver plano): casa por NOME, não por princípio ativo /
 * classe — não pega reatividade cruzada (penicilina × amoxicilina) nem
 * sinônimos/abreviações (AAS × ácido acetilsalicílico). Evolução prevista =
 * dicionário de princípios ativos. Por isso isto é UMA barreira, não a única.
 */

export type GravidadeAlergia = "LEVE" | "MODERADA" | "GRAVE";

export interface AlergiaAtiva {
  id: string;
  descricao: string;
  gravidade?: GravidadeAlergia | null;
}

export interface ItemPrescrito {
  medicamento: string;
}

export interface ConflitoAlergia {
  medicamento: string;
  alergiaId: string;
  alergiaDescricao: string;
  gravidade: GravidadeAlergia | null;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // remove marcas diacríticas combinantes
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizar(texto: string): string[] {
  const limpo = normalizar(texto);
  return limpo ? limpo.split(" ") : [];
}

/** A descrição da alergia casa o nome do medicamento? (heurística conservadora) */
export function alergiaCasaMedicamento(alergiaDescricao: string, medicamento: string): boolean {
  const termos = tokenizar(alergiaDescricao);
  if (termos.length === 0) return false;
  const tokensMed = tokenizar(medicamento);
  if (tokensMed.length === 0) return false;
  const setMed = new Set(tokensMed);
  return termos.some((termo) => {
    if (setMed.has(termo)) return true;
    // termo longo da alergia como raiz dentro de um token do medicamento
    if (termo.length >= 5) return tokensMed.some((m) => m.includes(termo));
    return false;
  });
}

/** Lista os conflitos entre os itens prescritos e as alergias ATIVAS. */
export function verificarConflitoAlergia(
  itens: readonly ItemPrescrito[],
  alergiasAtivas: readonly AlergiaAtiva[],
): ConflitoAlergia[] {
  const conflitos: ConflitoAlergia[] = [];
  for (const item of itens) {
    for (const alergia of alergiasAtivas) {
      if (alergiaCasaMedicamento(alergia.descricao, item.medicamento)) {
        conflitos.push({
          medicamento: item.medicamento,
          alergiaId: alergia.id,
          alergiaDescricao: alergia.descricao,
          gravidade: alergia.gravidade ?? null,
        });
      }
    }
  }
  return conflitos;
}

/** Atalho booleano — a "porta" do bloqueio na camada de serviço. */
export function temConflitoAlergia(
  itens: readonly ItemPrescrito[],
  alergiasAtivas: readonly AlergiaAtiva[],
): boolean {
  return verificarConflitoAlergia(itens, alergiasAtivas).length > 0;
}
