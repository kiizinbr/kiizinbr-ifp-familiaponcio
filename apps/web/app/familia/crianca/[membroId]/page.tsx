"use client";

/**
 * Tela 3 do portal: ficha da criança — quem pode buscar, alergias e os
 * CONSENTIMENTOS do titular (uso de imagem por criança + uso/compartilhamento
 * de dados por ficha). O responsável dá/revoga aqui mesmo (efeito imediato).
 */
import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  ChevronRight,
  Clock,
  Share2,
  ShieldCheck,
} from "lucide-react";

import { Alerta, BotaoResposta, Spinner } from "@/components/ui";
import { idade } from "@/lib/idade";
import { cn } from "@/lib/cn";
import {
  CONSENTIMENTO_DADOS_LABEL,
  ESCOPO_IMAGEM_LABEL,
  useConsentirDados,
  useConsentirImagem,
  useFichaCrianca,
  type EscopoImagem,
  type TipoConsentimentoFamilia,
} from "@/lib/use-educacional";

export default function FichaCriancaFamiliaPage({
  params,
}: {
  params: { membroId: string };
}) {
  const { membroId } = params;
  const { data, isLoading, error } = useFichaCrianca(membroId);
  const consentirImagem = useConsentirImagem(membroId);
  const consentirDados = useConsentirDados(membroId);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  // Trava a linha que está sendo salva (evita duplo clique no mesmo escopo/tipo).
  const [salvando, setSalvando] = useState<string | null>(null);

  async function mudarImagem(escopo: EscopoImagem, concedido: boolean) {
    setErroAcao(null);
    setSalvando(`img:${escopo}`);
    try {
      await consentirImagem.mutateAsync({ escopo, concedido });
    } catch (e) {
      setErroAcao((e as Error)?.message ?? "Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(null);
    }
  }

  async function mudarDados(tipo: TipoConsentimentoFamilia, concedido: boolean) {
    setErroAcao(null);
    setSalvando(`dados:${tipo}`);
    try {
      await consentirDados.mutateAsync({ tipo, concedido });
    } catch (e) {
      setErroAcao((e as Error)?.message ?? "Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(null);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Spinner label="Carregando ficha..." />
      </main>
    );
  }
  if (error || !data) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Alerta tipo="erro">{(error as Error)?.message ?? "Ficha não encontrada"}</Alerta>
      </main>
    );
  }

  const { crianca, autorizados, autorizacoesImagem, consentimentosDados } = data;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/familia/crianca"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Minhas crianças
      </Link>

      <h1 className="mt-2 text-lg font-bold text-foreground">{crianca.nomeCompleto}</h1>
      <p className="text-xs text-muted-foreground">
        {idade(crianca.dataNascimento)} anos
      </p>

      {erroAcao && (
        <div className="mt-4">
          <Alerta tipo="erro">{erroAcao}</Alerta>
        </div>
      )}

      <Link
        href={`/familia/crianca/${membroId}/linha-do-tempo`}
        className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-primary/50"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Clock className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            Linha do tempo
          </span>
          <span className="text-xs text-muted-foreground">
            A jornada da sua criança no instituto, do começo até hoje
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      {crianca.alergias.length > 0 && (
        <div className="mt-4 rounded-xl border border-danger/60 bg-danger/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-danger">
            <AlertTriangle className="h-4 w-4" /> Alergias que a equipe acompanha
          </p>
          <ul className="mt-1 text-sm text-foreground">
            {crianca.alergias.map((a) => (
              <li key={a.id}>{a.descricao}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" /> Quem pode buscar
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Só estas pessoas podem retirar sua criança. Para mudar a lista, fale com a
          secretaria.
        </p>
        <ul className="mt-3 space-y-2">
          {autorizados.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              {a.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.fotoUrl}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {a.nome
                    .split(/\s+/)
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">{a.nome}</p>
                <p className="text-xs capitalize text-muted-foreground">{a.parentesco}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Camera className="h-4 w-4 text-primary" /> Uso de imagem
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Você decide onde a imagem da sua criança pode aparecer. Sem a sua autorização,
          a resposta é sempre NÃO. Pode mudar quando quiser — vale na hora.
        </p>
        <ul className="mt-3 grid gap-2">
          {autorizacoesImagem.map((a) => {
            const autorizado = a.concedido && !a.revogadoEm;
            const ocupado = salvando === `img:${a.escopo}`;
            return (
              <li
                key={a.escopo}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
                  autorizado ? "border-success/60 bg-success/10" : "border-border bg-surface",
                )}
              >
                <span className="text-foreground">{ESCOPO_IMAGEM_LABEL[a.escopo]}</span>
                <div className="flex items-center gap-1.5">
                  <BotaoResposta
                    tom="sim"
                    ativo={autorizado}
                    disabled={ocupado}
                    onClick={() => mudarImagem(a.escopo, true)}
                  >
                    Autorizo
                  </BotaoResposta>
                  <BotaoResposta
                    tom="nao"
                    ativo={!autorizado}
                    disabled={ocupado}
                    onClick={() => mudarImagem(a.escopo, false)}
                  >
                    Não
                  </BotaoResposta>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Share2 className="h-4 w-4 text-primary" /> Meus dados (LGPD)
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Consentimentos da sua família sobre o uso e o compartilhamento dos dados. Você
          controla — e pode revogar a qualquer momento.
        </p>
        <ul className="mt-3 grid gap-2">
          {consentimentosDados.map((c) => {
            const ocupado = salvando === `dados:${c.tipo}`;
            return (
              <li
                key={c.tipo}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
                  c.concedido ? "border-success/60 bg-success/10" : "border-border bg-surface",
                )}
              >
                <span className="text-foreground">{CONSENTIMENTO_DADOS_LABEL[c.tipo]}</span>
                <div className="flex items-center gap-1.5">
                  <BotaoResposta
                    tom="sim"
                    ativo={c.concedido}
                    disabled={ocupado}
                    onClick={() => mudarDados(c.tipo, true)}
                  >
                    Autorizo
                  </BotaoResposta>
                  <BotaoResposta
                    tom="nao"
                    ativo={!c.concedido}
                    disabled={ocupado}
                    onClick={() => mudarDados(c.tipo, false)}
                  >
                    Não
                  </BotaoResposta>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
