import type { UsuarioRow, ProfissionalMapeado } from "./tipos";
import { slugEmail } from "./pessoa";
import { limparConselho, limparRegistro } from "./conselho";

const RE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/// Mapeia o usuário Amplimed em profissional. E-mail: prefere o login real
/// (coluna `usuario`, que na origem JÁ é um e-mail e é único) e só cai no
/// institucional gerado se faltar. Conselho/registro passam pela limpeza
/// (HTML-decode + lixo → placeholder). `problemas` é relatório, não bloqueia —
/// QUEM migra é decidido no load (referenciado por consulta, exclui admin).
export function mapUsuarioParaProfissional(row: UsuarioRow): ProfissionalMapeado {
  const problemas: string[] = [];
  const nome = row.nome?.trim() || "";
  if (!nome) problemas.push("nome ausente");

  const conselho = limparConselho(row.conselho);
  const uf = row.registrouf?.trim().toUpperCase() || "";
  const registro = limparRegistro(row.registroprof, row.registrouf);
  if (!conselho || !registro) problemas.push("conselho/registro profissional ausente ou inválido");

  const usuario = row.usuario?.trim() || "";
  const email = RE_EMAIL.test(usuario)
    ? usuario.toLowerCase()
    : slugEmail(nome || `prof${row.codu}`);

  return {
    codu: row.codu,
    nome,
    email,
    conselho: conselho || "—",
    nroConselho: registro ? (uf ? `${registro}-${uf}` : registro) : "—",
    especialidadeAmplimed: row.especialidade ?? null,
    problemas,
  };
}
