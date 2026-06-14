import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessUnidade } from "@/lib/rbac";
import { podeVerProntuario } from "@/lib/medico/rbac";
import { assertAcessoCidadao } from "@/lib/cidadao-authz";
import { renderReceitaPdf } from "@/lib/medico/receita-pdf";
import { logEvent } from "@/lib/audit";

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

  // A1 IDOR guard (read-side): o gate de papel (podeVerProntuario) NÃO confere a
  // unidade do OBJETO — gestor/profissional baixariam o PDF (nome, CRM,
  // medicamentos) de cidadão de outra unidade. Exige acesso à unidade do cidadão
  // da consulta antes de renderizar/logar (404 não vaza existência).
  const consulta = await db.consulta.findUnique({
    where: { id },
    select: { cidadaoId: true },
  });
  if (!consulta) return new NextResponse("Receita não encontrada", { status: 404 });
  try {
    await assertAcessoCidadao(session, consulta.cidadaoId, "view");
  } catch {
    return new NextResponse("Receita não encontrada", { status: 404 });
  }

  // Acesso a documento clínico (PHI) — registra na auditoria (LGPD Art. 11).
  await logEvent({
    userId: session.user.id,
    action: "medical_data_accessed",
    entityType: "receita",
    entityId: receita.id,
    rootEntityType: "cidadao",
    rootEntityId: consulta.cidadaoId,
    meta: { documento: "receita_pdf" },
  });

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
