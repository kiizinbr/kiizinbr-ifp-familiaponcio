"use client";

/**
 * Portal da família — "O que a gente recebeu".
 * Um lugar só com o resumo dos benefícios da família nas verticais do IFP
 * (creche, capacitação, esporte, saúde) + atalho para a galeria de conquistas.
 * Tom acolhedor, mobile-first (mesma linguagem do diário).
 */
import Link from "next/link";
import {
  Award,
  Baby,
  ChevronRight,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Sparkles,
} from "lucide-react";

import { Alerta, Spinner } from "@/components/ui";
import { useRecebido } from "@/lib/use-familia";

function CartaoNumero({
  icon,
  numero,
  rotulo,
}: {
  icon: React.ReactNode;
  numero: number;
  rotulo: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-surface px-3 py-4 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="text-2xl font-bold text-foreground">{numero}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </span>
    </div>
  );
}

export default function RecebidoPage() {
  const { data, isLoading, isError } = useRecebido();

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Spinner label="Reunindo o que a sua família já recebeu..." />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Alerta tipo="erro">
          Não foi possível carregar o resumo agora. Tente novamente em instantes.
        </Alerta>
      </main>
    );
  }

  const { resumo, creche, capacitacao, esporte } = data;
  const totalConquistas = resumo.certificados + resumo.graduacoes;
  const semNada =
    resumo.creche === 0 &&
    resumo.capacitacao === 0 &&
    resumo.esporte === 0 &&
    resumo.atendimentos === 0 &&
    totalConquistas === 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-foreground">O que a gente recebeu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tudo o que a sua família já acessou no Instituto, num lugar só. 💛
        </p>
      </header>

      {semNada ? (
        <Alerta tipo="info">
          Ainda não há benefícios registrados para a sua família. Assim que houver
          uma matrícula, atendimento ou conquista, aparece aqui.
        </Alerta>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <CartaoNumero icon={<Baby className="h-5 w-5" />} numero={resumo.creche} rotulo="Creche" />
            <CartaoNumero
              icon={<GraduationCap className="h-5 w-5" />}
              numero={resumo.capacitacao}
              rotulo="Cursos"
            />
            <CartaoNumero
              icon={<Dumbbell className="h-5 w-5" />}
              numero={resumo.esporte}
              rotulo="Esporte"
            />
            <CartaoNumero
              icon={<HeartPulse className="h-5 w-5" />}
              numero={resumo.atendimentos}
              rotulo="Atendimentos"
            />
            <CartaoNumero
              icon={<Award className="h-5 w-5" />}
              numero={resumo.certificados}
              rotulo="Certificados"
            />
            <CartaoNumero
              icon={<Sparkles className="h-5 w-5" />}
              numero={resumo.graduacoes}
              rotulo="Graduações"
            />
          </div>

          {/* Atalho para a galeria de conquistas */}
          <Link
            href="/familia/certificados"
            className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition hover:border-primary/50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Award className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                Conquistas e certificados
              </span>
              <span className="text-xs text-muted-foreground">
                {totalConquistas > 0
                  ? `${totalConquistas} ${totalConquistas === 1 ? "conquista" : "conquistas"} para ver e baixar`
                  : "Os certificados aparecem aqui quando concluídos"}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>

          {/* Detalhamento por vertical */}
          {creche.length > 0 && (
            <Secao titulo="Creche / educação infantil" icon={<Baby className="h-4 w-4" />}>
              {creche.map((m) => (
                <ItemLinha
                  key={m.id}
                  titulo={m.crianca.nomeCompleto}
                  detalhe={`${m.turma.nome} · ${m.unidade.nome}`}
                />
              ))}
            </Secao>
          )}

          {capacitacao.length > 0 && (
            <Secao titulo="Cursos de capacitação" icon={<GraduationCap className="h-4 w-4" />}>
              {capacitacao.map((m) => (
                <ItemLinha
                  key={m.id}
                  titulo={m.curso}
                  detalhe={`${m.beneficiario} · turma ${m.turma}`}
                  selo={m.temCertificado ? "Certificado emitido" : undefined}
                />
              ))}
            </Secao>
          )}

          {esporte.length > 0 && (
            <Secao titulo="Modalidades esportivas" icon={<Dumbbell className="h-4 w-4" />}>
              {esporte.map((m) => (
                <ItemLinha
                  key={m.id}
                  titulo={m.modalidade}
                  detalhe={`${m.beneficiario} · turma ${m.turma}`}
                  selo={m.graduacoes > 0 ? `${m.graduacoes} graduação(ões)` : undefined}
                />
              ))}
            </Secao>
          )}
        </>
      )}
    </main>
  );
}

function Secao({
  titulo,
  icon,
  children,
}: {
  titulo: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
        {icon}
        {titulo}
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function ItemLinha({
  titulo,
  detalhe,
  selo,
}: {
  titulo: string;
  detalhe: string;
  selo?: string;
}) {
  return (
    <li className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{titulo}</p>
          <p className="truncate text-xs text-muted-foreground">{detalhe}</p>
        </div>
        {selo && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {selo}
          </span>
        )}
      </div>
    </li>
  );
}
