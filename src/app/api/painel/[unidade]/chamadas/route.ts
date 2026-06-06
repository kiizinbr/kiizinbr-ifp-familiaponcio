import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { unidadeFromSlug } from "@/lib/unidades";
import { listarChamadas } from "@/lib/painel/chamada";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ unidade: string }> }) {
  const { unidade } = await params;
  if (!unidadeFromSlug(unidade)) {
    return new NextResponse("Unidade invalida", { status: 404 });
  }
  const session = await auth();
  if (!session) return new NextResponse("Nao autenticado", { status: 401 });
  if (!canAccessUnidade(session, unidade)) {
    return new NextResponse("Sem permissao", { status: 403 });
  }

  const { atual, recentes } = await listarChamadas(unidade, 5);
  return NextResponse.json({ atual, recentes });
}
