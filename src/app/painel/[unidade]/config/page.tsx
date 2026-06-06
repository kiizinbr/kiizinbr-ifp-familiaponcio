import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade, podeGerirPainel } from "@/lib/rbac";
import { unidadeFromSlug } from "@/lib/unidades";
import { db } from "@/lib/db";
import {
  adicionarAnuncioAction,
  removerAnuncioAction,
  salvarVideoAction,
} from "./painel-config-actions";

export const dynamic = "force-dynamic";

export default async function PainelConfigPage({
  params,
}: {
  params: Promise<{ unidade: string }>;
}) {
  const { unidade } = await params;
  if (!unidadeFromSlug(unidade)) redirect("/" as Route);
  const session = await auth();
  if (!session) redirect(`/${unidade}/login` as Route);
  if (!canAccessUnidade(session, unidade) || !podeGerirPainel(session)) redirect("/" as Route);

  const config = await db.painelConfig.findUnique({ where: { unidade } });
  const anuncios = await db.painelAnuncio.findMany({
    where: { unidade },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div
      className="ifp-kit"
      data-unit={unidade}
      data-unit-accent=""
      style={{ minHeight: "100vh", padding: 24, maxWidth: 720, margin: "0 auto" }}
    >
      <h1 style={{ color: "var(--text)", marginBottom: 16 }}>
        Painel — Configuracao ({unidade})
      </h1>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ color: "var(--text)", fontSize: 16 }}>Video do mes (YouTube)</h2>
        <form action={salvarVideoAction} style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input type="hidden" name="unidade" value={unidade} />
          <input
            name="videoUrl"
            defaultValue={config?.videoUrl ?? ""}
            placeholder="https://youtu.be/..."
            className="input"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary">
            Salvar
          </button>
        </form>
      </section>

      <section className="card">
        <h2 style={{ color: "var(--text)", fontSize: 16 }}>Anuncios do rodape</h2>
        <form
          action={adicionarAnuncioAction}
          style={{ display: "grid", gap: 8, marginTop: 12 }}
        >
          <input type="hidden" name="unidade" value={unidade} />
          <input
            name="texto"
            placeholder="Ex.: DIA 20 TEM WORKSHOP COM O CABELEREIRO LOTUFU"
            className="input"
            required
          />
          <label style={{ fontSize: 13, color: "var(--text-2)" }}>
            Ativo ate (opcional):{" "}
            <input type="date" name="ativoAte" className="input" style={{ width: "auto" }} />
          </label>
          <button
            type="submit"
            className="btn btn-secondary"
            style={{ justifySelf: "start" }}
          >
            Adicionar anuncio
          </button>
        </form>

        <ul style={{ marginTop: 16, display: "grid", gap: 8 }}>
          {anuncios.map((a) => (
            <li
              key={a.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <span style={{ color: "var(--text)" }}>
                {a.texto}
                {a.ativoAte ? (
                  <span style={{ color: "var(--text-3)", fontSize: 12 }}>
                    {" "}
                    · ate {a.ativoAte.toLocaleDateString("pt-BR")}
                  </span>
                ) : null}
              </span>
              <form action={removerAnuncioAction}>
                <input type="hidden" name="unidade" value={unidade} />
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="btn btn-danger btn-sm">
                  Remover
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
