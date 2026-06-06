import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { unidadeFromSlug } from "@/lib/unidades";
import { db } from "@/lib/db";
import { anuncioVigente } from "@/lib/painel/core";
import { PainelTV } from "./painel-tv";

export const dynamic = "force-dynamic";

export default async function PainelPage({ params }: { params: Promise<{ unidade: string }> }) {
  const { unidade } = await params;
  if (!unidadeFromSlug(unidade)) redirect("/" as Route);

  const session = await auth();
  if (!session) redirect(`/${unidade}/login` as Route);
  if (!canAccessUnidade(session, unidade)) redirect("/" as Route);

  const config = await db.painelConfig.findUnique({ where: { unidade } });
  const anunciosRaw = await db.painelAnuncio.findMany({
    where: { unidade },
    orderBy: { criadoEm: "desc" },
  });
  const agora = new Date();
  const anuncios = anunciosRaw.filter((a) => anuncioVigente(a, agora)).map((a) => a.texto);

  return (
    <div className="ifp-kit" data-unit={unidade} data-unit-accent="" style={{ minHeight: "100vh" }}>
      <PainelTV unidade={unidade} videoUrl={config?.videoUrl ?? null} anuncios={anuncios} />
    </div>
  );
}
