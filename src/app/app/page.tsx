import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import {
  EditorialCanvas,
  Masthead,
  KpiLedger,
  EditorialSectionTitle,
  EditorialTile,
  EditorialTileGrid,
  EditorialPanel,
  EditorialPanelGrid,
  type PanelItem,
} from "@/components/editorial";
import { getCidadaoStats } from "@/lib/cidadao";
import { countTriagensAbertas, listTriagensPendentes } from "@/lib/triagem";
import type { UnitScope } from "@/lib/rbac-types";

const UNIT_LABELS: Record<UnitScope, string> = {
  medico: "Centro Médico",
  capacitacao: "Capacitação",
  esportivo: "Esportivo",
  recreativo: "Recreativo",
};

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

export default async function GlobalDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

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

  const triagensItems: PanelItem[] = pendentes.slice(0, 6).map((t) => ({
    key: t.id,
    primary: t.cidadao.nomeCompleto,
    secondary: UNIT_LABELS[t.cidadao.unitIdOrigem as UnitScope],
    href: `/app/cidadaos/${t.cidadao.id}/triagem`,
  }));

  const atividadeItems: PanelItem[] = atividade.map((a) => ({
    key: a.id,
    primary: `${a.user?.name ?? a.user?.email ?? "Sistema"} ${
      ACTIVITY_LABELS[a.action] ?? a.action
    }`,
    secondary: formatDateTime(a.createdAt),
  }));

  return (
    <AppShell session={session}>
      <EditorialCanvas fullBleed>
        <Masthead
          kicker="Instituto Família Pôncio · Visão geral"
          title="Olá,"
          titleEm={firstName}
          dateWeekday={dataWeekday}
          dateFull={dataFull}
        />

        <KpiLedger
          columns={4}
          compact
          items={[
            {
              label: "Total de cidadãos",
              value: stats?.total ?? 0,
              suffix: "cadastros",
              tone: "orange",
            },
            { label: "Ativos", value: stats?.ativos ?? 0, suffix: "vigentes", tone: "teal" },
            {
              label: "Triagens pendentes",
              value: triagensAbertas,
              suffix: "em aberto",
              tone: "ink",
            },
            { label: "Excluídos", value: stats?.deletados ?? 0, suffix: "LGPD", tone: "muted" },
          ]}
        />

        <EditorialSectionTitle>Unidades</EditorialSectionTitle>
        <EditorialTileGrid>
          {(Object.keys(UNIT_LABELS) as UnitScope[]).map((u) => (
            <EditorialTile
              key={u}
              href={`/app/${u}`}
              accent={`rgb(var(--ifp-filter-${u}))`}
              label={UNIT_LABELS[u]}
              value={porUnidade.get(u) ?? 0}
              caption="cidadãos ativos"
            />
          ))}
        </EditorialTileGrid>

        <EditorialSectionTitle>Acompanhamento</EditorialSectionTitle>
        <EditorialPanelGrid>
          <EditorialPanel
            title="Triagens pendentes"
            items={triagensItems}
            emptyText="Nenhuma triagem pendente."
          />
          <EditorialPanel
            title="Atividade recente"
            items={atividadeItems}
            emptyText="Sem atividade registrada."
          />
        </EditorialPanelGrid>
      </EditorialCanvas>
    </AppShell>
  );
}
