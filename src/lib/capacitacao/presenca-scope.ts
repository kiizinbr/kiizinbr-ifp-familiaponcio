import { db } from "@/lib/db";

/**
 * Filtra um roster de matriculaIds (vindo do cliente) retornando SÓ os que
 * pertencem à turma indicada. Fecha o IDOR cross-turma em
 * registrarPresencasAction: o instrutor é dono da turma, mas o roster não era
 * validado contra ela — permitindo gravar presença em alunos de outra turma.
 */
export async function matriculasDaTurma(turmaId: string, roster: string[]): Promise<string[]> {
  if (roster.length === 0) return [];
  const validas = await db.matricula.findMany({
    where: { id: { in: roster }, turmaId },
    select: { id: true },
  });
  return validas.map((m) => m.id);
}
