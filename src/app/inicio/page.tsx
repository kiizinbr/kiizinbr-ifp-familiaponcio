import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { TemaUnidade } from "@/components/tema-unidade";
import { getCidadaoStats } from "@/lib/cidadao";
import { getLandingPath, hasAnyRole } from "@/lib/rbac";
import { countTriagensAbertas, listTriagensPendentes, podeFazerTriagem } from "@/lib/triagem";
import { unidadeFromSlug } from "@/lib/unidades";
import { cn } from "@/lib/utils";
import {
  saudacao,
  horaEmSaoPaulo,
  diasAguardando,
  labelEspera,
  fraseEstado,
  quadroDasCasas,
} from "@/lib/hub-inicio";
import styles from "./inicio.module.css";

const ACTIVITY_LABELS: Record<string, string> = {
  signin_success: "entrou no sistema",
  signout: "saiu do sistema",
  ficha_created: "cadastrou uma ficha",
  ficha_updated: "atualizou uma ficha",
  anexo_uploaded: "anexou um documento",
  anexo_removed: "removeu um anexo",
  triagem_aberta: "abriu uma triagem",
  triagem_concluida: "concluiu uma triagem",
  elegibilidade_decidida: "decidiu uma elegibilidade",
  role_changed: "alterou um papel",
};

function formatDateTime(date: Date): string {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * "Início" — o Briefing do Plantão dos papéis globais (super_admin / presidência).
 * Composição própria (manchete + fila numerada + livro-razão com filete lateral),
 * deliberadamente distinta do molde grid-de-cards de /acesso. 100% Server
 * Component: zero ação para presidência (read-only por construção — a tela só
 * navega) e a fila de triagem só renderiza para quem podeFazerTriagem.
 */
export default async function InicioDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  // /inicio é o painel cross-unidade dos papéis globais (super_admin/presidência,
  // conforme getLandingPath). Qualquer outro papel — que o pós-login agora pode
  // mandar pra cá — é resolvido pro seu destino real (ex.: recepção → /medico),
  // evitando parar no dashboard errado. Sem loop: só redireciona se home !== /inicio.
  const home = getLandingPath(session);
  if (home !== "/inicio") redirect(home as Route);

  const [stats, triagensAbertas, pendentes, atividade] = await Promise.all([
    getCidadaoStats(session),
    countTriagensAbertas(session),
    listTriagensPendentes(session),
    db.auditLog.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const porUnidade = new Map((stats?.porUnidade ?? []).map((u) => [u.unidade, u.total]));

  const agora = new Date();
  const dataWeekday = agora.toLocaleDateString("pt-BR", { weekday: "long" });
  const dataFull = agora.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const firstName = session.user.name?.split(" ")[0] ?? "Erick";

  const veTriagem = podeFazerTriagem(session); // false p/ presidência (gate de triagem.ts)
  const isSuper = hasAnyRole(session, "super_admin");
  const isPresidencia = hasAnyRole(session, "presidencia") && !isSuper;
  const cumprimento = saudacao(horaEmSaoPaulo(agora));
  const segmentos = fraseEstado({
    ativos: stats?.ativos ?? 0,
    triagens: triagensAbertas,
    veTriagem,
  });
  const { atendimento, transversais } = quadroDasCasas(porUnidade);
  const fila = pendentes.slice(0, 5);

  return (
    <AppShell session={session}>
      {/* ===== Seção A — Briefing (manchete direto no canvas) ===== */}
      <header className={styles.briefing}>
        <div className={styles.carimboRow}>
          <p className="micro" style={{ color: "var(--text-3)", margin: 0 }}>
            Instituto Família Pôncio · {dataWeekday} · {dataFull}
          </p>
          {isPresidencia && <span className="badge badge-default">Leitura institucional</span>}
        </div>
        <h1 className="t-display" style={{ color: "var(--text)" }}>
          {cumprimento}, {firstName}.
        </h1>
        <p className={styles.lede}>
          {segmentos.map((s, i) =>
            s.mono ? (
              <strong key={i} className="mono">
                {s.t}
              </strong>
            ) : (
              <span key={i}>{s.t}</span>
            ),
          )}
        </p>
        <p className={cn("micro", styles.registro)}>
          <span>{stats?.total ?? 0} cadastros</span>
          <span>{stats?.ativos ?? 0} ativos</span>
          {veTriagem && (
            <span className={cn(triagensAbertas > 0 && styles.registroVivo)}>
              {triagensAbertas} triagens em aberto
            </span>
          )}
          <span>{stats?.deletados ?? 0} excluídos lgpd</span>
        </p>
      </header>

      {/* ===== Seção B — grid assimétrico: fila de decisão + quadro das casas ===== */}
      <div className={cn(styles.grid, !veTriagem && styles.gridSolo)}>
        {veTriagem && (
          <section className="card">
            <header>
              <span className="tick" aria-hidden="true" />
              <h3>Para decidir hoje</h3>
              <Link className="act" href={"/social" as Route}>
                Serviço Social →
              </Link>
            </header>
            <div className="body">
              {fila.length === 0 ? (
                <div className="empty">
                  <Image src="/logo/ifp-symbol.png" alt="" width={96} height={96} />
                  <p className="e-title">Sem decisões pendentes</p>
                  <p className="e-msg">Todas as triagens foram concluídas.</p>
                </div>
              ) : (
                <ol className={styles.fila}>
                  {fila.map((t, i) => (
                    <li key={t.id} className={styles.filaItem}>
                      <span className={cn("mono", styles.filaNum)}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <Link
                        href={`/app/cidadaos/${t.cidadao.id}/triagem` as Route}
                        className={styles.filaNome}
                      >
                        {t.cidadao.nomeCompleto}
                      </Link>
                      <span className="chip">
                        {unidadeFromSlug(t.cidadao.unitIdOrigem)?.nome ?? t.cidadao.unitIdOrigem}
                      </span>
                      <span className={cn("mono", styles.filaEspera)}>
                        {labelEspera(diasAguardando(t.createdAt, agora))}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        )}

        <section className="card">
          <header>
            <span className="tick" aria-hidden="true" />
            <h3>As casas, hoje</h3>
          </header>
          <div className={styles.quadroBody}>
            <p className={cn("micro", styles.grupoLabel)}>Atendimento</p>
            {atendimento.map((c) => (
              <TemaUnidade key={c.slug} tema={c.slug}>
                <Link href={c.href as Route} className={styles.casaRow}>
                  <span className={styles.casaInfo}>
                    <span className={styles.casaNome}>{c.nome}</span>
                    <span className={styles.casaTagline}>{c.tagline}</span>
                  </span>
                  <span className={styles.casaMetrica}>
                    <span className={cn("mono", styles.casaValor)}>{c.ativos}</span>
                    <span className={styles.casaNota}>cidadãos ativos</span>
                  </span>
                  <span className={styles.casaSeta} aria-hidden="true">
                    →
                  </span>
                </Link>
              </TemaUnidade>
            ))}

            <p className={cn("micro", styles.grupoLabel)}>Gestão e transversais</p>
            {transversais.map((c) => (
              <TemaUnidade key={c.slug} tema={c.slug}>
                <Link href={c.href as Route} className={styles.casaRow}>
                  <span className={styles.casaInfo}>
                    <span className={styles.casaNome}>{c.nome}</span>
                    <span className={styles.casaTagline}>{c.tagline}</span>
                  </span>
                  <span className={styles.casaMetrica}>
                    {c.slug === "social" && veTriagem ? (
                      <>
                        <span className={cn("mono", styles.casaValor)}>{triagensAbertas}</span>
                        <span className={styles.casaNota}>triagens em aberto</span>
                      </>
                    ) : c.slug === "social" ? (
                      <span className={styles.casaNota}>acompanhamento das famílias</span>
                    ) : (
                      <span className={styles.casaNota}>leitura executiva</span>
                    )}
                  </span>
                  <span className={styles.casaSeta} aria-hidden="true">
                    →
                  </span>
                </Link>
              </TemaUnidade>
            ))}
          </div>
        </section>
      </div>

      {/* ===== Seção C — Pulso (últimos movimentos, full-width sem card) ===== */}
      <section className={styles.pulso}>
        <div className={styles.pulsoHead}>
          <p className="micro" style={{ color: "var(--text-3)", margin: 0 }}>
            Últimos movimentos
          </p>
          {isSuper && (
            <Link href={"/admin/audit" as Route} className={styles.pulsoAct}>
              Auditoria completa →
            </Link>
          )}
        </div>
        {atividade.length === 0 ? (
          <p className="t-small" style={{ color: "var(--text-3)" }}>
            Sem movimentação registrada.
          </p>
        ) : (
          <div className="timeline">
            {atividade.map((a) => (
              <div key={a.id} className="tl-item">
                <div className="tl-when">{formatDateTime(a.createdAt)}</div>
                <div className="tl-title">
                  {a.user?.name ?? a.user?.email ?? "Sistema"}{" "}
                  {ACTIVITY_LABELS[a.action] ?? a.action}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
