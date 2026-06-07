// Validação pós-migração: contagens origem × destino + integridade.
// Uso: pnpm migracao:validar  (lê origem MariaDB + destino Postgres).
import { PrismaClient } from "@prisma/client";
import { abrirOrigem } from "./origem";

const db = new PrismaClient();
const origem = await abrirOrigem();

const pacOrigem = await origem.contar("pacientes");
const conOrigem = await origem.contar("consulta");

// Contagens AUTORITATIVAS do que a migração gravou (tabela de proveniência).
const mapCidadao = await db.migracaoAmplimedMap.count({ where: { entidade: "cidadao" } });
const mapProf = await db.migracaoAmplimedMap.count({ where: { entidade: "profissional" } });
const mapConsulta = await db.migracaoAmplimedMap.count({ where: { entidade: "consulta" } });
const mapNota = await db.migracaoAmplimedMap.count({ where: { entidade: "nota" } });

// Totais no destino (incluem dados demo/seed pré-existentes).
const espDestino = await db.especialidade.count();
const profDestino = await db.profissional.count();
const cidMedico = await db.cidadao.count({ where: { unitIdOrigem: "medico" } });
const notaDestino = await db.notaEvolucao.count();
const diagDestino = await db.diagnosticoNota.count();
const slotsRealizados = await db.slot.count({ where: { status: "realizado" } });
const notasSemTexto = await db.notaEvolucao.count({ where: { texto: null } });

console.log("=== VALIDAÇÃO MIGRAÇÃO AMPLIMED ===");
console.log("");
console.log("-- Migrado (proveniência) --");
console.log(`  cidadãos:      ${mapCidadao}  (origem pacientes: ${pacOrigem})`);
console.log(`  profissionais: ${mapProf}`);
console.log(`  consultas:     ${mapConsulta}  (origem consulta: ${conOrigem})`);
console.log(`  notas:         ${mapNota}`);
console.log("");
console.log("-- Destino (totais, inclui demo/seed) --");
console.log(`  especialidades: ${espDestino} · profissionais: ${profDestino}`);
console.log(`  cidadãos médico: ${cidMedico} · slots realizados: ${slotsRealizados}`);
console.log(`  notas: ${notaDestino} (sem texto: ${notasSemTexto}) · diagnósticos: ${diagDestino}`);
console.log("");

const integridadeOk = mapConsulta === mapNota;
console.log("-- Integridade --");
console.log(
  `  consultas migradas == notas migradas? ${integridadeOk ? "✅ SIM" : "⚠️ NÃO"} (${mapConsulta} vs ${mapNota})`,
);
console.log(
  `  consultas não migradas (origem − migrado): ${conOrigem - mapConsulta} (esperado: órfãs + admin + sem-prof + codu=0)`,
);

await origem.fechar();
await db.$disconnect();
