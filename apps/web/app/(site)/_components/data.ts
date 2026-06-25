/**
 * Conteúdo do site institucional público (portado 1:1 do kit do Designer:
 * site-institucional/"Site Institucional.html"). Textos REAIS do brief.
 * As cores das unidades saem do brandbook (mesmas do ifp-tokens.css).
 *
 * Acesso por unidade: o dropdown e os botões apontam para as rotas REAIS do
 * app autenticado (/acesso, /login?unidade=<slug>) — não para os HTMLs do kit.
 */

/** Onde cada item de acesso leva no app React (mapeia 1:1 com /login). */
export interface AcessoItem {
  unit: string;
  slug: string; // ?unidade=<slug> em /login
  nome: string;
  descricao: string;
  phrase: string; // frase do loader de transição
  u1: string;
  u2: string;
}

/** Unidades de atendimento (logam pelo /login?unidade=<slug>). */
export const ACESSO_UNIDADES: AcessoItem[] = [
  {
    unit: "medico",
    slug: "medico",
    nome: "Centro Médico",
    descricao: "Saúde e odontológico",
    phrase: "Preparando o atendimento…",
    u1: "#007571",
    u2: "#10c2bb",
  },
  {
    unit: "capacitacao",
    slug: "capacitacao",
    nome: "Centro de Capacitação",
    descricao: "Cursos e profissionalização",
    phrase: "Carregando sua turma…",
    u1: "#ff772e",
    u2: "#c24d0f",
  },
  {
    unit: "esportivo",
    slug: "esportivo",
    nome: "Centro Esportivo",
    descricao: "Esporte, disciplina e Jiu-Jitsu",
    phrase: "Aquecendo…",
    u1: "#c24d0f",
    u2: "#752c05",
  },
  {
    unit: "recreativo",
    slug: "educacional",
    nome: "Centro Recreativo",
    descricao: "Recreação e cuidado infantil",
    phrase: "Chegando pra brincar…",
    u1: "#10c2bb",
    u2: "#007571",
  },
];

/** Equipe interna (entram pelos canais de apoio e diretoria). */
export const ACESSO_INTERNO: AcessoItem[] = [
  {
    unit: "social",
    slug: "servico-social",
    nome: "Serviço Social",
    descricao: "Apoio interno e triagem",
    phrase: "Organizando as fichas…",
    u1: "#4a4a49",
    u2: "#6b6b6b",
  },
  {
    unit: "poncio",
    slug: "presidencia",
    nome: "Acesso Executivo",
    descricao: "Diretoria · visão geral",
    phrase: "Reunindo os números…",
    u1: "#752c05",
    u2: "#4a4a49",
  },
];

/** Slideshow do hero — ordem das 4 frentes (sincroniza fundo + medalhão). */
export interface HeroSlide {
  unit: string;
  nome: string;
  color: string;
  bg: string;
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    unit: "medico",
    nome: "Centro Médico",
    color: "#007571",
    bg: "/site/fotos/aerea-centro-medico.jpg",
  },
  {
    unit: "capacitacao",
    nome: "Centro de Capacitação",
    color: "#ff772e",
    bg: "/site/fotos/aerea-capacitacao.jpg",
  },
  {
    unit: "esportivo",
    nome: "Centro Esportivo",
    color: "#c24d0f",
    bg: "https://static.wixstatic.com/media/fb51a3_825d4d74bde84711a87fa15409c2dbe6~mv2.jpg/v1/fill/w_1600,h_1040,al_c,q_85,enc_avif,quality_auto/he-esp.jpg",
  },
  {
    unit: "recreativo",
    nome: "Centro Recreativo",
    color: "#10c2bb",
    bg: "https://static.wixstatic.com/media/fb51a3_32fba3b6b23949b0b7208b8167f27635~mv2.jpg/v1/fill/w_1600,h_1040,al_c,q_85,enc_avif,quality_auto/he-rec.jpg",
  },
];

/** Reflexões da "Palavra do Dia" (giram por dia-do-ano, day % 14). */
export const REFLECTIONS: { m: string; r: string }[] = [
  { m: "“O generoso prosperará; quem dá alívio aos outros, alívio receberá.”", r: "Provérbios 11:25" },
  { m: "Acolher uma criança é acolher o próprio amor de Deus.", r: "Inspirado em Mateus 18:5" },
  { m: "“Não nos cansemos de fazer o bem, pois no tempo certo colheremos.”", r: "Gálatas 6:9" },
  { m: "Cada gesto de cuidado planta uma semente que floresce além do que se vê.", r: "Reflexão do dia" },
  { m: "“Tudo o que fizerem, façam de todo o coração, como para o Senhor.”", r: "Colossenses 3:23" },
  { m: "“Levem as cargas uns dos outros; assim cumprirão a lei de Cristo.”", r: "Gálatas 6:2" },
  { m: "“Sede fortes e corajosos; o Senhor caminha com vocês.”", r: "Josué 1:9" },
  { m: "Onde há uma família que cuida, há sempre um lar para recomeçar.", r: "Reflexão do dia" },
  { m: "“O amor é paciente, o amor é bondoso. Tudo suporta, tudo espera.”", r: "1 Coríntios 13:4-7" },
  { m: "“Deem, e será dado a vocês: uma boa medida, transbordante.”", r: "Lucas 6:38" },
  { m: "“A esperança não decepciona, porque o amor de Deus foi derramado em nós.”", r: "Romanos 5:5" },
  { m: "“A fé é a certeza daquilo que esperamos e a prova do que não vemos.”", r: "Hebreus 11:1" },
  { m: "Servir ao próximo com amor é a forma mais bonita de mudar realidades.", r: "Reflexão do dia" },
  { m: "“O Senhor é bom, um refúgio em tempos de angústia.”", r: "Naum 1:7" },
];
