"use client";

/**
 * Saúde populacional — retrato AGREGADO e ANÔNIMO do dado clínico que o banco
 * já guarda (condições crônicas, alergias, triagens de enfermagem, atendimentos
 * selados). Honesto por construção: a presidência vê CONTAGENS, nunca a ficha
 * de um paciente. Não há diagnóstico inventado, nem IA — só agregação do real.
 */
import { Activity, AlertTriangle, HeartPulse, MapPin, Stethoscope } from "lucide-react";

import { Card, Kpi, PageHeader, SecTitle } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";
import { GRAVIDADE_COR, RISCO_COR, useSaudePresidencia } from "@/lib/use-presidencia";
import { Barras } from "../_components";

const RISCO_LABEL: Record<string, string> = {
  VERMELHO: "Vermelho · emergência",
  LARANJA: "Laranja · muito urgente",
  AMARELO: "Amarelo · urgente",
  VERDE: "Verde · pouco urgente",
  AZUL: "Azul · não urgente",
};

export default function SaudePresidenciaPage() {
  const { data, isLoading, error } = useSaudePresidencia();

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        titulo="Saúde populacional"
        descricao="Retrato agregado e anônimo do cuidado clínico — contagens por condição, gravidade, risco e faixa etária. Nunca um paciente individual."
      />

      {isLoading ? <Spinner label="Carregando o panorama de saúde..." /> : null}
      {error ? <Alerta>{(error as Error).message}</Alerta> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="Pessoas sob cuidado" valor={data.kpis.pessoasSobCuidado.toLocaleString("pt-BR")} />
            <Kpi label="Condições crônicas ativas" valor={data.kpis.condicoesAtivas.toLocaleString("pt-BR")} />
            <Kpi label="Alergias registradas" valor={data.kpis.alergiasAtivas.toLocaleString("pt-BR")} />
            <Kpi label="Triagens de enfermagem" valor={data.kpis.triagens.toLocaleString("pt-BR")} />
            <Kpi label="Atendimentos selados" valor={data.kpis.atendimentosSelados.toLocaleString("pt-BR")} />
          </div>

          {data.kpis.pessoasSobCuidado === 0 &&
          data.porCondicao.length === 0 &&
          data.alergiasPorGravidade.length === 0 ? (
            <Card className="mt-6">
              <p className="text-sm text-muted-foreground">
                Ainda não há dado clínico agregável (condições, alergias ou triagens).
              </p>
            </Card>
          ) : (
            <>
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <Card>
                  <SecTitle icon={<Stethoscope />}>Condições crônicas mais frequentes</SecTitle>
                  <Barras
                    itens={data.porCondicao.map((c) => ({
                      label: c.cid10 ? `${c.descricao} (${c.cid10})` : c.descricao,
                      valor: c.total,
                    }))}
                  />
                  <p className="mt-4 text-xs text-muted-foreground">
                    Contagem de condições crônicas ativas por descrição (com CID-10 quando
                    registrado). Nenhum vínculo com paciente.
                  </p>
                </Card>

                <Card>
                  <SecTitle icon={<HeartPulse />}>Faixa etária sob cuidado</SecTitle>
                  <Barras
                    itens={data.faixaEtaria.map((f) => ({ label: `${f.faixa} anos`, valor: f.total }))}
                  />
                  <p className="mt-4 text-xs text-muted-foreground">
                    Pessoas (titulares ou membros) com ao menos uma condição ou alergia ativa,
                    por faixa etária. Cada pessoa conta uma vez.
                  </p>
                </Card>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Card>
                  <SecTitle icon={<AlertTriangle />}>Alergias por gravidade</SecTitle>
                  {data.alergiasPorGravidade.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem alergias registradas.</p>
                  ) : (
                    <Barras
                      itens={data.alergiasPorGravidade.map((a) => ({
                        label: a.gravidade,
                        valor: a.total,
                        cor: GRAVIDADE_COR[a.gravidade],
                      }))}
                    />
                  )}
                  <p className="mt-4 text-xs text-muted-foreground">
                    Alergias ativas agrupadas pela gravidade registrada na ficha clínica.
                  </p>
                </Card>

                <Card>
                  <SecTitle icon={<Activity />}>Triagens por classificação de risco</SecTitle>
                  {data.triagensPorRisco.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem triagens de enfermagem ainda.</p>
                  ) : (
                    <Barras
                      itens={data.triagensPorRisco.map((t) => ({
                        label: RISCO_LABEL[t.risco] ?? t.risco,
                        valor: t.total,
                        cor: RISCO_COR[t.risco],
                      }))}
                    />
                  )}
                  <p className="mt-4 text-xs text-muted-foreground">
                    Acolhimento de enfermagem por classificação de risco (protocolo de Manchester).
                  </p>
                </Card>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Card>
                  <SecTitle icon={<Stethoscope />}>Atendimentos por CID-10</SecTitle>
                  {data.porCid10.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum atendimento selado tem CID-10 registrado ainda.
                    </p>
                  ) : (
                    <Barras
                      itens={data.porCid10.map((c) => ({ label: c.cid10, valor: c.total }))}
                    />
                  )}
                  <p className="mt-4 text-xs text-muted-foreground">
                    Motivos clínicos dos atendimentos encerrados, pelo CID-10 anotado pelo
                    profissional. Top códigos.
                  </p>
                </Card>

                <Card>
                  <SecTitle icon={<MapPin />}>Cobertura clínica por bairro</SecTitle>
                  {data.porBairro.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Ainda não há famílias com dado clínico e bairro informado.
                    </p>
                  ) : (
                    <Barras
                      itens={data.porBairro.map((b) => ({ label: b.bairro, valor: b.total }))}
                    />
                  )}
                  <p className="mt-4 text-xs text-muted-foreground">
                    Famílias ativas com ao menos uma condição ou alergia ativa, pelo bairro do
                    endereço cadastrado.
                  </p>
                </Card>
              </div>
            </>
          )}

          <p className="mt-6 text-xs text-muted-foreground">
            Todos os números são agregados anônimos sobre o dado clínico já existente. A Sala de
            Comando vê quantos, jamais quem — nenhuma ficha ou paciente individual é exposto.
          </p>
        </>
      ) : null}
    </main>
  );
}
