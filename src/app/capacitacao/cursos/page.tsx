import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import clsx from "clsx";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { podeGerenciarCurso } from "@/lib/capacitacao/rbac";
import { PageHead, KitBadge } from "../_components/ui";
import { criarCursoAction } from "../actions";
import styles from "../capacitacao.module.css";

export default async function CatalogoPage({
  searchParams,
}: {
  // C3 (PASSE 1): ?criado=1 do redirect de criarCursoAction → banner role=status.
  // C9 (PASSE 2): ?q (busca por nome) e ?area (chip) — estado na URL, filtro server-side.
  searchParams: Promise<{ criado?: string; q?: string; area?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/capacitacao/login" as Route);
  if (!canAccessUnidade(session, "capacitacao")) redirect("/" as Route);

  const podeCriar = podeGerenciarCurso(session);
  const { criado, q, area } = await searchParams;
  const busca = (q ?? "").trim();
  const areaFiltro = (area ?? "").trim();

  const cursos = await db.curso.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    include: { _count: { select: { turmas: true } } },
  });
  const ativos = cursos.filter((c) => c.ativo).length;

  // Áreas distintas para os chips (derivadas do catálogo; não inventa filtro vazio).
  const areas = [...new Set(cursos.map((c) => c.area))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  // C9 — filtro de exibição (server-side, sem tocar a query nem a paginação).
  const buscaLower = busca.toLowerCase();
  const cursosFiltrados = cursos.filter((c) => {
    const casaBusca =
      !buscaLower ||
      c.nome.toLowerCase().includes(buscaLower) ||
      c.area.toLowerCase().includes(buscaLower);
    const casaArea = !areaFiltro || c.area === areaFiltro;
    return casaBusca && casaArea;
  });
  const temFiltro = busca.length > 0 || areaFiltro.length > 0;

  return (
    <CapacitacaoShell session={session}>
      <PageHead
        eyebrow="Capacitação · Catálogo"
        eyebrowHref="/capacitacao"
        title="Cursos"
        desc="O catálogo de cursos da capacitação. Cada curso gera turmas datadas com vagas, instrutor e matrículas."
      />

      {criado === "1" ? (
        <div role="status" className={styles.alert}>
          Curso criado.
        </div>
      ) : null}

      <div className={podeCriar ? styles.grid2 : undefined}>
        {podeCriar ? (
          <div className="card" style={{ alignSelf: "start" }}>
            <header>
              <span className="tick" />
              <h3>NOVO CURSO</h3>
              <span className="act text-3">
                {ativos} ativo{ativos === 1 ? "" : "s"} · {cursos.length} no total
              </span>
            </header>
            <div className="body">
              <form action={criarCursoAction}>
                <label className="field-group">
                  <span className="label">Nome do curso</span>
                  <input
                    name="nome"
                    required
                    placeholder="Ex: Informática Básica"
                    className="input"
                  />
                </label>
                <label className="field-group">
                  <span className="label">Área</span>
                  <input name="area" required placeholder="Ex: Tecnologia" className="input" />
                </label>
                <label className="field-group">
                  <span className="label">Descrição</span>
                  <textarea
                    name="descricao"
                    placeholder="Breve descrição do conteúdo e objetivos."
                    className="textarea"
                  />
                </label>
                <div className={styles.fieldGrid}>
                  <label className="field-group">
                    <span className="label">Modalidade</span>
                    <select name="modalidade" className="select" defaultValue="presencial">
                      <option value="presencial">Presencial</option>
                      <option value="online">Online</option>
                      <option value="hibrido">Híbrido</option>
                    </select>
                  </label>
                  <label className="field-group">
                    <span className="label">Carga horária (h)</span>
                    <input
                      name="cargaHorariaTotal"
                      type="number"
                      min={1}
                      defaultValue={20}
                      className="input"
                    />
                  </label>
                </div>
                <label className="field-group">
                  <span className="label">Capacidade padrão por turma</span>
                  <input
                    name="capacidadePadrao"
                    type="number"
                    min={1}
                    defaultValue={20}
                    className="input"
                  />
                </label>
                <SubmitButton className="btn-block" pendingLabel="Adicionando curso…">
                  Adicionar curso
                </SubmitButton>
              </form>
            </div>
          </div>
        ) : null}

        {cursos.length === 0 ? (
          <EmptyState
            titulo="Nenhum curso cadastrado ainda"
            descricao={
              podeCriar
                ? "Use o formulário ao lado para criar o primeiro."
                : "Os cursos aparecem aqui assim que forem cadastrados."
            }
          />
        ) : (
          <div>
            {/* C9 — busca/filtro com estado na URL (?q / ?area). GET → o form
                serializa pra searchParam; a área selecionada vai num hidden pra
                sobreviver à busca, e os chips de área são Links que setam ?area. */}
            <form method="get" className={styles.filterBar} role="search">
              {areaFiltro ? <input type="hidden" name="area" value={areaFiltro} /> : null}
              <input
                type="search"
                name="q"
                defaultValue={busca}
                placeholder="Buscar por nome ou área…"
                aria-label="Buscar cursos"
                className="input"
              />
              <SubmitButton variant="ghost" size="sm" pendingLabel="Buscando…">
                Buscar
              </SubmitButton>
              {temFiltro ? (
                <Link href={"/capacitacao/cursos" as Route} className="btn btn-secondary btn-sm">
                  Limpar
                </Link>
              ) : null}
            </form>

            {areas.length > 1 ? (
              <div className={styles.chipRow}>
                <Link
                  href={
                    (busca
                      ? `/capacitacao/cursos?q=${encodeURIComponent(busca)}`
                      : "/capacitacao/cursos") as Route
                  }
                  className={clsx(styles.chip, !areaFiltro && styles.chipAtivo)}
                  aria-current={!areaFiltro ? "page" : undefined}
                >
                  Todas
                </Link>
                {areas.map((a) => {
                  const params = new URLSearchParams();
                  if (busca) params.set("q", busca);
                  params.set("area", a);
                  const ativo = areaFiltro === a;
                  return (
                    <Link
                      key={a}
                      href={`/capacitacao/cursos?${params.toString()}` as Route}
                      className={clsx(styles.chip, ativo && styles.chipAtivo)}
                      aria-current={ativo ? "page" : undefined}
                    >
                      {a}
                    </Link>
                  );
                })}
              </div>
            ) : null}

            {cursosFiltrados.length === 0 ? (
              <EmptyState
                titulo="Nenhum curso encontrado"
                descricao="Ajuste a busca ou o filtro de área para ver mais cursos."
              />
            ) : (
              <div className={styles.cards}>
                {cursosFiltrados.map((c) => (
                  <Link
                    key={c.id}
                    href={`/capacitacao/cursos/${c.id}` as Route}
                    className={styles.course}
                  >
                    <span className={styles.courseArea}>{c.area}</span>
                    <span className={styles.courseName}>{c.nome}</span>
                    {!c.ativo ? (
                      <span className={styles.courseBadge}>
                        <KitBadge variant="default">Inativo</KitBadge>
                      </span>
                    ) : null}
                    {c.descricao ? <span className={styles.courseDesc}>{c.descricao}</span> : null}
                    <span className={styles.courseFoot}>
                      <span>
                        <b>{c.cargaHorariaTotal}h</b> · {c.modalidade}
                      </span>
                      <span>
                        <b>{c._count.turmas}</b> turma{c._count.turmas === 1 ? "" : "s"}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </CapacitacaoShell>
  );
}
