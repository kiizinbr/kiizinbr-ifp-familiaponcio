import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessUnidade } from "@/lib/rbac";
import { podeVerProntuario } from "@/lib/medico/rbac";
import { renderReceitaPdf } from "@/lib/medico/receita-pdf";

/**
 * Download (inline) do receituário em PDF. Mesmo gate de leitura do prontuário:
 * super_admin / gestor_unidade / profissional. A receita precisa pertencer à
 * consulta da URL (evita enumerar IDs por outra rota).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; receitaId: string }> },
) {
  const session = await auth();
  if (!session) return new NextResponse("Não autenticado", { status: 401 });
  if (!canAccessUnidade(session, "medico") || !podeVerProntuario(session)) {
    return new NextResponse("Sem permissão", { status: 403 });
  }

  const { id, receitaId } = await params;
  const receita = await db.receita.findUnique({
    where: { id: receitaId },
    include: { itens: true },
  });
  if (!receita || receita.consultaId !== id) {
    return new NextResponse("Receita não encontrada", { status: 404 });
  }

  const buf = await renderReceitaPdf({
    nomePaciente: receita.nomePaciente,
    nomeProfissional: receita.nomeProfissional,
    conselho: receita.conselho,
    nroConselho: receita.nroConselho,
    observacoes: receita.observacoes,
    itens: receita.itens.map((it) => ({
      medicamento: it.medicamento,
      posologia: it.posologia,
      quantidade: it.quantidade,
      via: it.via,
    })),
    emitidoEm: receita.emitidoEm,
  });

  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": "inline; filename=receita.pdf",
    },
  });
}
