import type { UsuarioRow, ProfissionalMapeado } from "./tipos";
import { slugEmail } from "./pessoa";

export function mapUsuarioParaProfissional(row: UsuarioRow): ProfissionalMapeado {
  const problemas: string[] = [];
  const nome = row.nome?.trim() || "";
  if (!nome) problemas.push("nome ausente");
  const conselho = row.conselho?.trim() || "";
  const registro = row.registroprof?.trim() || "";
  if (!conselho || !registro) problemas.push("conselho/registro profissional ausente");
  const uf = row.registrouf?.trim().toUpperCase() || "";
  return {
    codu: row.codu,
    nome,
    email: slugEmail(nome || `prof${row.codu}`),
    conselho: conselho || "—",
    nroConselho: uf ? `${registro}-${uf}` : registro || "—",
    especialidadeAmplimed: row.especialidade ?? null,
    problemas,
  };
}
