import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import styles from "./editorial.module.css";
import { EditorialClock } from "./editorial-clock";

/**
 * Componentes do tema "Editorial temperada" do Centro Médico.
 * Encapsulam editorial.module.css — quem usa NÃO importa o módulo direto.
 * Aprovado por Erick 2026-05-31 (ver docs/.../2026-05-31-editorial-temperada-propagacao.md).
 */

/**
 * Wrapper de página: aplica o canvas creme+grão + a largura editorial.
 * fullBleed cancela o padding do AppShell <main> (creme até as bordas).
 */
export function EditorialCanvas({
  children,
  fullBleed,
}: {
  children: ReactNode;
  fullBleed?: boolean;
}) {
  return (
    <div className={`${styles.canvas} ${fullBleed ? styles.bleed : ""}`}>
      <div className={styles.shell}>{children}</div>
    </div>
  );
}

interface MastheadProps {
  kicker: string;
  /** Título principal (serifa display). */
  title: string;
  /** Segunda linha do título, em itálico (opcional). Ex.: "do dia". */
  titleEm?: string;
  /** Dia da semana por extenso ("quinta-feira"). */
  dateWeekday: string;
  /** Data completa ("29 de maio de 2026"). */
  dateFull: string;
  /** Ação à direita (ex.: botão "Marcar consulta"). */
  action?: ReactNode;
  /** Mostra o relógio ao vivo na dateline. Default true. */
  showClock?: boolean;
}

/** Cabeçalho editorial: kicker + título serifado + dateline + filete. */
export function Masthead({
  kicker,
  title,
  titleEm,
  dateWeekday,
  dateFull,
  action,
  showClock = true,
}: MastheadProps) {
  return (
    <header className={styles.masthead}>
      <div className={styles.kicker}>
        <span className={styles.kickerRule} aria-hidden="true" />
        <span aria-hidden="true">🦁</span>
        {kicker}
      </div>
      <div className={styles.titlerow}>
        <h1 className={styles.title}>
          {title}
          {titleEm && (
            <>
              <br />
              <em>{titleEm}</em>
            </>
          )}
        </h1>
        {action && <div className={styles.action}>{action}</div>}
        <div className={styles.dateline}>
          <div className={styles.day}>{dateWeekday}</div>
          <div className={styles.full}>{dateFull}</div>
          {showClock && <EditorialClock />}
        </div>
      </div>
      <div className={styles.underline} aria-hidden="true" />
    </header>
  );
}

type KpiTone = "orange" | "teal" | "ink" | "muted";

interface KpiItem {
  label: string;
  value: number | string;
  suffix?: string;
  tone: KpiTone;
  hint?: string;
}

// CSS-module classes são `string | undefined` sob noUncheckedIndexedAccess;
// coalesce p/ string (a classe sempre existe no .module.css em runtime).
const KPI_TONE_CLASS: Record<KpiTone, string> = {
  orange: styles.kpiOrange ?? "",
  teal: styles.kpiTeal ?? "",
  ink: styles.kpiInk ?? "",
  muted: styles.kpiMuted ?? "",
};

/**
 * Livro-razão de KPIs: número-manchete em Fraunces + filete colorido por tom.
 * `columns` define a grade (default 3); `compact` reduz o número p/ dashboards densos.
 */
export function KpiLedger({
  items,
  columns = 3,
  compact = false,
}: {
  items: KpiItem[];
  columns?: number;
  compact?: boolean;
}) {
  const style = { ["--ledger-cols" as string]: String(columns) } as React.CSSProperties;
  return (
    <section
      className={`${styles.ledger} ${compact ? styles.ledgerCompact : ""}`}
      style={style}
      aria-label="Resumo"
    >
      {items.map((k) => (
        <div key={k.label} className={`${styles.kpi} ${KPI_TONE_CLASS[k.tone]}`}>
          <div className={styles.kpiLabel}>{k.label}</div>
          <div className={styles.kpiNum}>
            {k.value}
            {k.suffix && <span className={styles.kpiSuffix}>{k.suffix}</span>}
          </div>
          {k.hint && <div className={styles.kpiHint}>{k.hint}</div>}
        </div>
      ))}
    </section>
  );
}

/** Título de seção editorial (small-caps + filete). Ex.: "Unidades". */
export function EditorialSectionTitle({ children }: { children: ReactNode }) {
  return <h2 className={styles.sectionTitle}>{children}</h2>;
}

interface TileProps {
  href?: string;
  /** Cor do filete superior (ex.: "rgb(var(--ifp-filter-medico))"). */
  accent?: string;
  label: string;
  value: number | string;
  caption?: string;
}

/** Cartão-ladrilho editorial (ex.: resumo por unidade). Número em Fraunces. */
export function EditorialTile({ href, accent, label, value, caption }: TileProps) {
  const style = accent
    ? ({ ["--tile-accent" as string]: accent } as React.CSSProperties)
    : undefined;
  const inner = (
    <>
      <span className={styles.tileBar} style={style} aria-hidden="true" />
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
      {caption && <span className={styles.tileCaption}>{caption}</span>}
    </>
  );
  return href ? (
    <Link href={href as Route} className={styles.tile}>
      {inner}
    </Link>
  ) : (
    <div className={styles.tile}>{inner}</div>
  );
}

/** Grade responsiva de ladrilhos. */
export function EditorialTileGrid({ children }: { children: ReactNode }) {
  return <div className={styles.tileGrid}>{children}</div>;
}

export interface PanelItem {
  key: string;
  primary: string;
  secondary?: string;
  href?: string;
}

/**
 * Painel editorial: card com título serifado + lista de itens com hairlines.
 * Passe `items` (lista) ou `children` (conteúdo livre).
 */
export function EditorialPanel({
  title,
  items,
  emptyText = "Nada por aqui.",
  children,
}: {
  title: string;
  items?: PanelItem[];
  emptyText?: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.panel}>
      <h3 className={styles.panelTitle}>{title}</h3>
      <div className={styles.panelBody}>
        {items ? (
          items.length === 0 ? (
            <p className={styles.panelEmpty}>{emptyText}</p>
          ) : (
            <ul className={styles.panelList}>
              {items.map((it) => (
                <li key={it.key} className={styles.panelItem}>
                  {it.href ? (
                    <Link href={it.href as Route} className={styles.panelLink}>
                      {it.primary}
                    </Link>
                  ) : (
                    <span className={styles.panelPrimary}>{it.primary}</span>
                  )}
                  {it.secondary && <span className={styles.panelMeta}>{it.secondary}</span>}
                </li>
              ))}
            </ul>
          )
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/** Grade de 2 colunas pros painéis. */
export function EditorialPanelGrid({ children }: { children: ReactNode }) {
  return <div className={styles.panelGrid}>{children}</div>;
}

interface LegendItem {
  color: string;
  label: string;
}

interface AgendaProps {
  title: string;
  legend?: LegendItem[];
  children: ReactNode;
}

/** Bloco da pauta: cabeçalho + legenda + lista de linhas. */
export function Agenda({ title, legend, children }: AgendaProps) {
  return (
    <>
      <div className={styles.agendaHead}>
        <div className={styles.agendaTitle}>{title}</div>
        {legend && legend.length > 0 && (
          <div className={styles.legend} aria-hidden="true">
            {legend.map((l) => (
              <span key={l.label}>
                <i style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <main className={styles.agenda}>{children}</main>
    </>
  );
}

type StatusKind = "done" | "confirmed" | "scheduled" | "now" | "muted" | "danger";

const BADGE_CLASS: Record<StatusKind, string> = {
  done: styles.badgeDone ?? "",
  confirmed: styles.badgeConfirmed ?? "",
  scheduled: styles.badgeScheduled ?? "",
  now: styles.badgeNow ?? "",
  muted: styles.badgeMuted ?? "",
  danger: styles.badgeDanger ?? "",
};

interface TimelineRowProps {
  href?: string;
  time: string;
  durationMin?: number | null;
  specColor?: string;
  specName?: string;
  patientName?: string;
  proRole?: string;
  proName?: string;
  /** "now" = em atendimento (faixa teal + barra em curso); "free" = slot vago. */
  variant?: "default" | "now" | "free";
  statusLabel?: string;
  statusKind?: StatusKind;
  /** Minutos decorridos da consulta em curso (só variant="now"). */
  elapsedMin?: number;
  /** Atraso do stagger de entrada, em segundos. */
  delaySec?: number;
}

/** Uma linha da pauta: hora + paciente/especialidade + profissional + status. */
export function TimelineRow({
  href,
  time,
  durationMin,
  specColor,
  specName,
  patientName,
  proRole = "Profissional",
  proName,
  variant = "default",
  statusLabel,
  statusKind = "scheduled",
  elapsedMin,
  delaySec = 0,
}: TimelineRowProps) {
  const style: React.CSSProperties = { animationDelay: `${delaySec}s` };
  if (specColor) {
    (style as Record<string, string>)["--spec"] = specColor;
  }

  // Slot livre — layout reduzido (hora + "disponível")
  if (variant === "free") {
    const body = (
      <>
        <div className={styles.eTime}>{time}</div>
        <div className={styles.vacant}>
          Horário disponível
          <small>toque para agendar</small>
        </div>
      </>
    );
    return href ? (
      <Link href={href as Route} className={`${styles.entry} ${styles.entryFree}`} style={style}>
        {body}
      </Link>
    ) : (
      <div className={`${styles.entry} ${styles.entryFree}`} style={style}>
        {body}
      </div>
    );
  }

  const isNow = variant === "now";
  // largura da barra "em curso" = decorrido / duração, limitado a [4%, 100%]
  const prog =
    isNow && durationMin && elapsedMin != null
      ? Math.max(4, Math.min(100, Math.round((elapsedMin / durationMin) * 100)))
      : null;
  if (prog != null) {
    (style as Record<string, string>)["--prog"] = `${prog}%`;
  }

  const body = (
    <>
      <div className={styles.eTime}>
        {time}
        {durationMin != null && <span className={styles.eDur}>{durationMin} min</span>}
      </div>
      <div>
        {patientName && <div className={styles.eName}>{patientName}</div>}
        {specName && (
          <div className={styles.spec}>
            <i />
            {specName}
          </div>
        )}
        {isNow && prog != null && (
          <div className={styles.elapsed}>
            <span className={styles.elapsedLabel}>em curso · ~{elapsedMin} min</span>
            <span className={styles.barwrap}>
              <b />
            </span>
          </div>
        )}
      </div>
      <div className={styles.ePro}>
        <span className={styles.eRole}>{proRole}</span>
        <span className={styles.eWho}>{proName}</span>
      </div>
      <div className={styles.eStatus}>
        <span className={`${styles.badge} ${BADGE_CLASS[statusKind]}`}>
          {statusKind === "now" && <span className={styles.pulse} aria-hidden="true" />}
          {statusLabel}
        </span>
      </div>
    </>
  );

  const className = `${styles.entry} ${isNow ? styles.entryNow : ""}`;
  return href ? (
    <Link
      href={href as Route}
      className={className}
      style={style}
      aria-current={isNow ? "true" : undefined}
    >
      {body}
    </Link>
  ) : (
    <div className={className} style={style} aria-current={isNow ? "true" : undefined}>
      {body}
    </div>
  );
}

/** Estado vazio editorial (dia sem consultas). */
export function EditorialEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyTitle}>{title}</div>
      <div className={styles.emptyText}>{text}</div>
    </div>
  );
}

/** Rodapé editorial. */
export function Colophon({ left, right }: { left: string; right: string }) {
  return (
    <footer className={styles.colophon}>
      <span>{left}</span>
      <span className={styles.mark}>IFP Connect</span>
      <span>{right}</span>
    </footer>
  );
}
