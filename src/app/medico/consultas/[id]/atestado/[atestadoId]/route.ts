import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessUnidade } from "@/lib/rbac";
import { podeVerProntuario } from "@/lib/medico/rbac";
import { renderAtestadoPdf } from "@/lib/medico/atestado-pdf";

/**
 * Download (inline) do atestado em PDF. Mesmo gate de leitura do prontuário:
 * super_admin / gestor_unidade / profissional. O atestado precisa pertencer à
 * consulta da URL.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; atestadoId: string }> },
) {
  const session = await auth();
  if (!session) return new NextResponse("Não autenticado", { status: 401 });
  if (!canAccessUnidade(session, "medico") || !podeVerProntuario(session)) {
    return new NextResponse("Sem permissão", { status: 403 });
  }

  const { id, atestadoId } = await params;
  const atestado = await db.atestado.findUnique({ where: { id: atestadoId } });
  if (!atestado || atestado.consultaId !== id) {
    return new NextResponse("Atestado não encontrado", { status: 404 });
  }

  const buf = await renderAtestadoPdf({
    nomePaciente: atestado.nomePaciente,
    nomeProfissional: atestado.nomeProfissional,
    conselho: atestado.conselho,
    nroConselho: atestado.nroConselho,
    diasAfastamento: atestado.diasAfastamento,
    cid: atestado.cid,
    observacao: atestado.observacao,
    emitidoEm: atestado.emitidoEm,
  });

  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": "inline; filename=atestado.pdf",
    },
  });
}
