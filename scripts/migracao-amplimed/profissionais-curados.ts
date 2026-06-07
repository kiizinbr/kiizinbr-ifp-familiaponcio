// CURADORIA (one-shot) dos profissionais Amplimed → IFP Connect.
//
// POR QUE CURADO e não auto-parse do nome:
//   - A coluna `especialidade` (int) da Amplimed é inútil como chave: esp=0 cobre
//     19 profissionais de especialidades completamente diferentes (cardio, psico,
//     odonto, pediatria…). O sinal real da especialidade está no NOME
//     ("GINECOLOGIA - Dra. Girlani"), mas em formatos inconsistentes (com traço,
//     sem traço, só-especialidade, só-nome-da-pessoa, tudo-maiúsculo).
//   - O conjunto é PEQUENO e FIXO: 47 profissionais referenciados por consulta
//     (50 codu distintos em consulta − 1 codu=0 sem linha em `usuarios` − 2 admin).
//   → Um mapa curado é mais correto e auditável que um parser frágil.
//
// REVISÁVEL: Erick pode vetar/ajustar qualquer especialidade ou nome de exibição.
// Fonte: scripts/migracao-amplimed/05-inspecionar-origem.sh (2026-06-07).
// E-mail / conselho / nº de registro NÃO ficam aqui — saem limpos da origem (mapper).

export interface ProfissionalCurado {
  especialidade: string;
  nomeExibicao: string;
}

/** Contas administrativas/sistema — NÃO migrar (consultas delas são puladas). */
export const ADMIN_CODUS: ReadonlySet<number> = new Set([911943, 911944, 960014]);

/** codu Amplimed → especialidade canônica + nome de exibição (47 referenciados). */
export const PROFISSIONAIS_CURADOS: Record<number, ProfissionalCurado> = {
  918241: { especialidade: "Ginecologia", nomeExibicao: "Dra. Girlani" },
  918239: { especialidade: "Clínico Geral", nomeExibicao: "Dr. Sergio Padilha" },
  921603: { especialidade: "Cardiologia", nomeExibicao: "Dr. Vinicius" },
  920741: { especialidade: "Endocrinologia", nomeExibicao: "Dra. Sabrina Camara" },
  918244: { especialidade: "Clínico Geral", nomeExibicao: "Dr. Kelvin" },
  918249: { especialidade: "Nutrição", nomeExibicao: "Natacha Guedes" },
  918247: { especialidade: "Laboratório", nomeExibicao: "Laboratório" },
  918242: { especialidade: "Psicologia Adulto", nomeExibicao: "Dra. Adna de Luna" },
  918250: { especialidade: "Psicologia Adulto", nomeExibicao: "Dra. Luciene" },
  918237: { especialidade: "Psicologia Infantil", nomeExibicao: "Dra. Aline" },
  918246: { especialidade: "Pediatria", nomeExibicao: "Dra. Maria Angélica" },
  974782: { especialidade: "Psiquiatria", nomeExibicao: "Dr. Matheus Monteiro" },
  922329: { especialidade: "Pediatria", nomeExibicao: "Dra. Ana Paula" },
  922327: { especialidade: "Pediatria", nomeExibicao: "Dra. Cristina Prado" },
  921600: { especialidade: "Odontologia Clínica", nomeExibicao: "Dr. Aldreison" },
  920740: { especialidade: "Dermatologia", nomeExibicao: "Dra. Daniela Brum" },
  921606: { especialidade: "Odontopediatria", nomeExibicao: "Dra. Aline Menezes" },
  918252: { especialidade: "Neuropediatria", nomeExibicao: "Michelle Oliveira" },
  918240: { especialidade: "Fonoaudiologia", nomeExibicao: "Dra. Regina Cristina" },
  918245: { especialidade: "Eletrocardiograma", nomeExibicao: "Eletrocardiograma" },
  921612: { especialidade: "Odontopediatria", nomeExibicao: "Dra. Mariana" },
  921608: { especialidade: "Odontopediatria", nomeExibicao: "Dra. Ana Clara" },
  922331: { especialidade: "Odontopediatria", nomeExibicao: "Dra. Amanda Luna" },
  921611: { especialidade: "Odontopediatria", nomeExibicao: "Dra. Leticia" },
  921601: { especialidade: "Prótese Dentária", nomeExibicao: "Dr. Eduardo" },
  921605: { especialidade: "Cirurgia Oral", nomeExibicao: "Dr. Mauricio" },
  918243: { especialidade: "Odontologia Clínica", nomeExibicao: "Dra. Milena Pedrotti" },
  917703: { especialidade: "Procedimentos", nomeExibicao: "Procedimentos" },
  921604: { especialidade: "Endodontia", nomeExibicao: "Dr. Luiz Renato" },
  929112: { especialidade: "Ortodontia", nomeExibicao: "Dra. Amanda" },
  929119: { especialidade: "Prótese Dentária", nomeExibicao: "Dra. Maria Beatriz" },
  962961: { especialidade: "Psicologia Infantil", nomeExibicao: "Dra. Pamela" },
  944714: { especialidade: "Ultrassonografia", nomeExibicao: "Dr. Marcos" },
  918295: { especialidade: "Serviço Social", nomeExibicao: "Serviço Social" },
  921614: { especialidade: "Periodontia", nomeExibicao: "Dra. Camila" },
  918236: { especialidade: "Cardiologia", nomeExibicao: "Dra. Rosangela" },
  922328: { especialidade: "Serviço Social", nomeExibicao: "Regina Simões" },
  918251: { especialidade: "Psicologia Infantil", nomeExibicao: "Dra. Cassiany" },
  921609: { especialidade: "Odontopediatria", nomeExibicao: "Dra. Diana" },
  923215: { especialidade: "Odontologia Clínica", nomeExibicao: "Dra. Raquel Barros" },
  921610: { especialidade: "Serviço Social", nomeExibicao: "Serviço Social 2" },
  921613: { especialidade: "Odontopediatria", nomeExibicao: "Dra. Rayana" },
  1085734: { especialidade: "Pediatria", nomeExibicao: "Marta de Souza Oliveira Vasquez" },
  1079545: { especialidade: "Prótese Dentária", nomeExibicao: "Dr. Luiz Guilherme" },
  1095002: { especialidade: "Odontologia Clínica", nomeExibicao: "Eduarda Guimarães" },
  948411: { especialidade: "Medicina Hiperbárica", nomeExibicao: "Hiperbárica" },
  918261: { especialidade: "Acolhimento", nomeExibicao: "Acolhimento" },
};
