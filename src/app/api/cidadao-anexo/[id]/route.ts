import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, podeVerSaudeCidadao, podeVerSocioCidadao } from "@/lib/rbac";
import { logEvent } from "@/lib/audit";
import { getCidadaoAnexoDownloadUrl } from "@/lib/minio";
import type { UnitScope } from "@/lib/rbac-types";

/**
 * Endpoint que gera URL presigned de download e redireciona o browser.
 * RBAC: usuário precisa ter acesso à unidade do cidadão dono do anexo.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL("/login", _req.url));
  }

  const { id } = await params;
  const anexo = await db.anexoCidadao.findUnique({
    where: { id, deletedAt: null },
    include: { cidadao: { select: { unitIdOrigem: true } } },
  });
  if (!anexo) {
    return new NextResponse("Anexo não encontrado", { status: 404 });
  }

  const acessoUnidade = can(session, "view", "ficha_cidada", {
    unitScope: anexo.cidadao.unitIdOrigem as UnitScope,
  });
  // Minimizacao por categoria (LGPD): anexo de saude exige o gate clinico,
  // socioeconomico exige o gate do social; geral fica no gate da ficha. Espelha
  // a redacao de campos clinicos/socio que ja vale no resto da ficha.
  const acessoCategoria =
    anexo.categoria === "saude"
      ? podeVerSaudeCidadao(session)
      : anexo.categoria === "socioeconomico"
        ? podeVerSocioCidadao(session)
        : true;
  if (!acessoUnidade || !acessoCategoria) {
    return new NextResponse("Sem permissão", { status: 403 });
  }

  // Acesso a documento do cidadao — registra na auditoria (LGPD).
  await logEvent({
    userId: session.user.id,
    action: "anexo_baixado",
    entityType: "anexo_cidadao",
    entityId: anexo.id,
    rootEntityType: "cidadao",
    rootEntityId: anexo.cidadaoId,
    meta: { categoria: anexo.categoria, fileName: anexo.fileName },
  });

  try {
    const url = await getCidadaoAnexoDownloadUrl(anexo.storageKey);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("[anexo-download]", error);
    return new NextResponse("Erro ao gerar download", { status: 500 });
  }
}
