import mysql, { type RowDataPacket } from "mysql2/promise";
import type {
  PacienteRow,
  UsuarioRow,
  ConsultaRow,
  FotoPacienteRow,
  PacsimgRow,
} from "../../src/lib/migracao-amplimed/tipos";

/**
 * Camada de leitura da origem Amplimed (MariaDB descartável restaurado pelo
 * 00-restore-mariadb.sh em 127.0.0.1:3399). Read-only.
 */
export async function abrirOrigem() {
  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3399,
    user: "root",
    password: "src",
    database: "amplimed",
    // Colunas DATE/DATETIME (ex.: consulta.dtconsulta) vêm como string "YYYY-MM-DD"
    // em vez de Date — casa com os tipos *Row e com parseDataNascimento.
    dateStrings: true,
  });
  return {
    async pacientes(): Promise<PacienteRow[]> {
      const [r] = await conn.query<RowDataPacket[]>("SELECT * FROM pacientes");
      return r as unknown as PacienteRow[];
    },
    async usuarios(): Promise<UsuarioRow[]> {
      const [r] = await conn.query<RowDataPacket[]>("SELECT * FROM usuarios");
      return r as unknown as UsuarioRow[];
    },
    async consultas(): Promise<ConsultaRow[]> {
      const [r] = await conn.query<RowDataPacket[]>("SELECT * FROM consulta");
      return r as unknown as ConsultaRow[];
    },
    async fotosPaciente(): Promise<FotoPacienteRow[]> {
      const [r] = await conn.query<RowDataPacket[]>(
        "SELECT codp, fotopac FROM pacientes WHERE fotopac IS NOT NULL AND fotopac <> ''",
      );
      return r as unknown as FotoPacienteRow[];
    },
    async pacsimg(): Promise<PacsimgRow[]> {
      // deleted enum 'true'/'false' (default 'false') → mantém não-deletadas
      const [r] = await conn.query<RowDataPacket[]>(
        "SELECT codimg, codp, codConsulta, endimg, legenda, datacad FROM pacsimg WHERE deleted <> 'true' AND endimg IS NOT NULL AND endimg <> ''",
      );
      return r as unknown as PacsimgRow[];
    },
    /** Amostra do JSON `configuracao` (§0.B — decidir se tem texto clínico útil). */
    async amostraConfiguracao(limite: number): Promise<string[]> {
      const [r] = await conn.query<RowDataPacket[]>(
        `SELECT configuracao FROM consulta_configuracao LIMIT ${limite}`,
      );
      return (r as unknown as { configuracao: string | null }[]).map((x) => x.configuracao ?? "");
    },
    async contar(tabela: string): Promise<number> {
      const [r] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM \`${tabela}\``);
      const row = r[0] as { n: number } | undefined;
      return row ? Number(row.n) : 0;
    },
    async fechar(): Promise<void> {
      await conn.end();
    },
  };
}
