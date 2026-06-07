import { abrirOrigem } from "./origem";
import { mapPacienteParaCidadao } from "../../src/lib/migracao-amplimed/cidadao";
import { mapUsuarioParaProfissional } from "../../src/lib/migracao-amplimed/profissional";

/**
 * PROFILE da origem Amplimed — Extract + relatório. NÃO grava nada no IFP.
 * Reporta só contagens, padrões e estrutura (NUNCA dado pessoal de paciente).
 * Insumo dos checkpoints §0.A (sem CPF/dup), §0.B (consulta_configuracao),
 * §0.D (e-mails de profissionais), §0.E (mapa de especialidade).
 * Uso: pnpm migracao:profile  (origem precisa estar de pé — 00-restore-mariadb.sh)
 */
async function main(): Promise<void> {
  const origem = await abrirOrigem();
  const pacientes = await origem.pacientes();
  const usuarios = await origem.usuarios();

  const cid = pacientes.map(mapPacienteParaCidadao);
  const limpos = cid.filter((c) => c.problemas.length === 0);
  const aRevisar = cid.filter((c) => c.problemas.length > 0);

  const porCpf = new Map<string, number>();
  for (const c of cid) if (c.cpf) porCpf.set(c.cpf, (porCpf.get(c.cpf) ?? 0) + 1);
  const dupCpf = [...porCpf.entries()].filter(([, n]) => n > 1);
  const semCpf = cid.filter((c) => c.cpf === null).length;

  const probs = new Map<string, number>();
  for (const c of aRevisar)
    for (const p of c.problemas) {
      const k = p.replace(/:.*/, "");
      probs.set(k, (probs.get(k) ?? 0) + 1);
    }

  const prof = usuarios.map(mapUsuarioParaProfissional);
  const profProblemas = prof.filter((p) => p.problemas.length > 0).length;

  console.log("=== PROFILE Amplimed (NADA é gravado) ===");
  console.log(
    `Pacientes: ${pacientes.length} · limpos ${limpos.length} · a revisar ${aRevisar.length}`,
  );
  console.log(`§0.A → Sem CPF: ${semCpf} · CPFs duplicados (distintos): ${dupCpf.length}`);
  console.log(`Usuários: ${usuarios.length} · com problema (conselho/nome): ${profProblemas}`);

  console.log("\n-- Tipos de problema (pacientes) --");
  for (const [p, n] of [...probs.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`  ${n}\t${p}`);

  console.log("\n-- §0.E Especialidades (int distintos em usuarios) --");
  const esp = new Map<number, number>();
  for (const u of usuarios)
    if (u.especialidade != null) esp.set(u.especialidade, (esp.get(u.especialidade) ?? 0) + 1);
  for (const [e, n] of [...esp.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`  ${n}\tesp=${e}`);

  console.log("\n-- §0.D E-mails sintetizados (profissionais — revisar) --");
  for (const p of prof.slice(0, 40))
    console.log(`  codu=${p.codu}\t${p.email}\t(${p.conselho} ${p.nroConselho})`);

  console.log("\n-- Contagens de tabelas-chave --");
  for (const t of ["consulta", "consulta_configuracao", "pacspsicologia", "documentosprescricoes"])
    console.log(`  ${await origem.contar(t)}\t${t}`);

  console.log("\n-- §0.B consulta_configuracao: estrutura (chaves do JSON, SEM valores) --");
  const amostra = await origem.amostraConfiguracao(5);
  for (const a of amostra) {
    const estrutura = ((): string => {
      try {
        const o: unknown = JSON.parse(a);
        if (Array.isArray(o)) return `array[${o.length}]`;
        return Object.keys(o as Record<string, unknown>)
          .slice(0, 18)
          .join(",");
      } catch {
        return "(não-JSON)";
      }
    })();
    console.log(`  len=${a.length}\tkeys=${estrutura}`);
  }

  await origem.fechar();
  console.log("\nNada foi escrito. Decisões §0.A/§0.B/§0.D/§0.E se confirmam aqui.");
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
