/**
 * Guia PÚBLICO do cidadão — "Como ser atendido no IFP".
 * Página estática (sem login, sem chamada à API) que explica os serviços do
 * Instituto Família Poncio e o passo a passo para ser atendido em cada um.
 * Destino do link na verificação pública de documento e candidata a ser
 * referenciada no site institucional.
 */
import Link from "next/link";
import {
  ArrowRight,
  Baby,
  FileText,
  GraduationCap,
  HeartHandshake,
  Medal,
  Phone,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

export const metadata = {
  title: "Como ser atendido · IFP",
  description:
    "Guia do cidadão: serviços do Instituto Família Poncio e como ser atendido em saúde, capacitação, esporte e educação infantil.",
};

/** Serviços de atendimento ao público, com o passo a passo de cada um. */
const SERVICOS: {
  nome: string;
  icone: React.ReactNode;
  resumo: string;
  passos: string[];
}[] = [
  {
    nome: "Centro Médico",
    icone: <Stethoscope className="h-6 w-6" />,
    resumo: "Atendimento médico filantrópico em diversas especialidades.",
    passos: [
      "Procure a recepção do Centro Médico com um documento com foto.",
      "Faça (ou atualize) sua Ficha Cidadã com a equipe do Serviço Social.",
      "A recepção agenda a consulta e você é chamado por ordem de fila.",
      "Atestados, receitas e declarações saem com QR e código para verificação.",
    ],
  },
  {
    nome: "Centro de Capacitação",
    icone: <GraduationCap className="h-6 w-6" />,
    resumo: "Cursos gratuitos para inserção no mercado de trabalho.",
    passos: [
      "Consulte as turmas abertas na unidade ou no Serviço Social.",
      "Faça a matrícula apresentando documento com foto e comprovante de residência.",
      "Frequente as aulas — a presença é registrada para o certificado.",
      "Ao concluir, você recebe um certificado verificável (com QR e código).",
    ],
  },
  {
    nome: "Centro Esportivo",
    icone: <Medal className="h-6 w-6" />,
    resumo: "Modalidades esportivas com graduações verificáveis.",
    passos: [
      "Escolha a modalidade e a turma disponível para a sua faixa etária.",
      "Para menores de idade, o responsável assina a matrícula e o consentimento.",
      "Participe das aulas e avaliações de graduação.",
      "As graduações concedidas têm diploma com QR e código de verificação.",
    ],
  },
  {
    nome: "Centro Educacional",
    icone: <Baby className="h-6 w-6" />,
    resumo: "Educação infantil com diário do dia e comunicados às famílias.",
    passos: [
      "Procure a unidade para conhecer as vagas de educação infantil.",
      "Matricule a criança com a documentação dela e do responsável.",
      "Acompanhe o dia a dia pelo Portal da Família (diário, recados e ficha).",
    ],
  },
  {
    nome: "Serviço Social",
    icone: <HeartHandshake className="h-6 w-6" />,
    resumo: "Porta de entrada das famílias: Ficha Cidadã e acompanhamento.",
    passos: [
      "Procure o Serviço Social para abrir a sua Ficha Cidadã.",
      "A equipe avalia a elegibilidade e orienta os encaminhamentos.",
      "A partir daí, você é direcionado aos serviços de que precisa.",
    ],
  },
];

export default function ComoSerAtendidoPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="text-center">
        <p className="text-xs uppercase tracking-widest text-primary">
          Instituto Família Poncio
        </p>
        <h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
          Como ser atendido
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
          O IFP oferece saúde, capacitação, esporte e educação infantil de forma gratuita.
          Veja abaixo o que cada serviço faz e o passo a passo para ser atendido.
        </p>
      </header>

      <section aria-label="Serviços" className="mt-10 space-y-5">
        {SERVICOS.map((s) => (
          <article
            key={s.nome}
            className="rounded-lg border border-border bg-surface p-6 shadow-ifp-sm"
          >
            <div className="flex items-start gap-3">
              <span className="text-primary">{s.icone}</span>
              <div>
                <h2 className="text-lg font-semibold text-foreground">{s.nome}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{s.resumo}</p>
              </div>
            </div>
            <ol className="mt-4 space-y-2">
              {s.passos.map((passo, i) => (
                <li key={i} className="flex gap-3 text-sm text-foreground">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                  >
                    {i + 1}
                  </span>
                  <span>{passo}</span>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </section>

      <section
        aria-label="Verificação de documentos"
        className="mt-8 rounded-lg border border-border bg-muted/40 p-6"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-6 w-6 flex-none text-primary" />
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Recebeu um documento do IFP?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Atestados, certificados e diplomas têm um código de verificação. Confirme a
              autenticidade a qualquer momento, sem precisar de login.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/verificar-documento"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-ifp-sm transition hover:bg-primary-hover"
              >
                <FileText className="h-4 w-4" /> Verificar documento médico
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-label="Contato"
        className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-surface p-6 shadow-ifp-sm"
      >
        <Phone className="h-6 w-6 flex-none text-primary" />
        <div>
          <h2 className="text-base font-semibold text-foreground">Onde nos encontrar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Instituto Família Poncio — Duque de Caxias/RJ. Procure a recepção da unidade
            mais próxima para iniciar o seu atendimento.
          </p>
        </div>
      </section>

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Voltar ao início <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  );
}
