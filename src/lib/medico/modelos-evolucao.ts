/**
 * Modelos de evolução por especialidade — helper PURO (sem zod, sem schema, sem
 * banco). Constante ADITIVA, fácil de editar pela equipe clínica depois.
 *
 * Chaveado por `Especialidade.nome` (campo existente, @unique — Especialidade não
 * tem slug/codigo, então `nome` é a chave natural). Se o nome no banco não bater
 * a string EXATA daqui, o atendimento ainda recebe os modelos `_geral` (degrada
 * graciosamente — nunca quebra, nunca fica sem modelo).
 *
 * Os textos usam estruturas clínicas consagradas (SOAP, queixa/HDA/conduta) como
 * andaime — o médico preenche; inserir um modelo no rascunho é equivalente a
 * digitar (a nota imutável só nasce na assinatura).
 */

export type ModeloEvolucao = { titulo: string; texto: string };

/** Modelos sempre disponíveis, independentes da especialidade. */
const GERAL: ModeloEvolucao[] = [
  {
    // #18 — marcadores canônicos (## Subjetivo / ## Objetivo / ## Avaliação /
    // ## Plano) p/ que "Copiar modelo SOAP" caia direto nas 4 caixas do
    // SoapEditor. parseSoap reconhece esses cabeçalhos; livre permanece livre.
    titulo: "SOAP",
    texto: "## Subjetivo\n\n## Objetivo\n\n## Avaliação\n\n## Plano\n",
  },
  {
    titulo: "Queixa / HDA / Conduta",
    texto:
      "Queixa principal: \n\n" +
      "História da doença atual: \n\n" +
      "Exame físico: \n\n" +
      "Hipótese diagnóstica: \n\n" +
      "Conduta: ",
  },
  {
    titulo: "Retorno",
    texto:
      "Retorno de consulta.\n\n" +
      "Evolução desde o último atendimento: \n\n" +
      "Adesão ao tratamento: \n\n" +
      "Conduta: ",
  },
];

/**
 * Modelos específicos por especialidade. Chave = `Especialidade.nome` EXATO.
 * Mantido pequeno e ADITIVO — a equipe clínica amplia conforme a demanda real.
 */
export const MODELOS_EVOLUCAO: Record<string, ModeloEvolucao[]> = {
  "Clínica Médica": [
    {
      titulo: "Consulta clínica",
      texto:
        "Queixa principal: \n\n" +
        "HDA: \n\n" +
        "Antecedentes pessoais: \n" +
        "Medicações em uso: \n\n" +
        "Exame físico:\n- Estado geral: \n- ACV: \n- AR: \n- Abdome: \n\n" +
        "Hipótese diagnóstica: \n\n" +
        "Conduta: ",
    },
  ],
  Pediatria: [
    {
      titulo: "Consulta pediátrica",
      texto:
        "Acompanhante: \n\n" +
        "Queixa: \n\n" +
        "Alimentação / sono / eliminações: \n\n" +
        "Desenvolvimento neuropsicomotor: \n" +
        "Vacinação: \n\n" +
        "Exame físico:\n- Peso/altura/PC: \n- Estado geral: \n\n" +
        "Hipótese diagnóstica: \n\n" +
        "Conduta / orientações aos pais: ",
    },
  ],
  Ginecologia: [
    {
      titulo: "Consulta ginecológica",
      texto:
        "Queixa: \n\n" +
        "DUM: \n" +
        "Ciclo menstrual: \n" +
        "Método contraceptivo: \n" +
        "G_P_A_: \n\n" +
        "Exame físico / exame ginecológico: \n\n" +
        "Hipótese diagnóstica: \n\n" +
        "Conduta: ",
    },
  ],
  Cardiologia: [
    {
      titulo: "Avaliação cardiológica",
      texto:
        "Queixa: \n\n" +
        "Fatores de risco cardiovascular: \n\n" +
        "Exame físico:\n- PA: \n- FC / ritmo: \n- Ausculta cardíaca: \n- Pulsos / edema: \n\n" +
        "ECG / exames: \n\n" +
        "Hipótese diagnóstica: \n\n" +
        "Conduta: ",
    },
  ],
  Psiquiatria: [
    {
      titulo: "Avaliação psiquiátrica",
      texto:
        "Queixa: \n\n" +
        "História psiquiátrica / medicações em uso: \n\n" +
        "Exame do estado mental:\n- Apresentação / humor / afeto: \n- Pensamento / sensopercepção: \n- Risco (auto/heteroagressivo): \n\n" +
        "Hipótese diagnóstica: \n\n" +
        "Conduta: ",
    },
  ],
};

/**
 * Modelos aplicáveis a uma especialidade: os específicos (se a string bater) +
 * os `_geral` (sempre). Função pura, sem efeitos colaterais — segura para chamar
 * no server component e passar o resultado serializável ao island.
 */
export function modelosPara(nomeEspecialidade: string): ModeloEvolucao[] {
  const especificos = MODELOS_EVOLUCAO[nomeEspecialidade] ?? [];
  return [...especificos, ...GERAL];
}
