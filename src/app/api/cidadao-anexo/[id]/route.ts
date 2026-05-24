import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
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

  const allowed = can(session, "view", "ficha_cidada", {
    unitScope: anexo.cidadao.unitIdOrigem as UnitScope,
  });
  if (!allowed) {
    return new NextResponse("Sem permissão", { status: 403 });
  }

  try {
    const url = await getCidadaoAnexoDownloadUrl(anexo.storageKey);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("[anexo-download]", error);
    return new NextResponse("Erro ao gerar download", { status: 500 });
  }
}
