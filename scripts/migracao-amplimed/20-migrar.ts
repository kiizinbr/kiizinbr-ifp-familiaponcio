// Migração Amplimed → IFP Connect — Load (Transform + Load).
// Uso: pnpm migracao:run            (DRY-RUN: lê tudo, conta, NÃO grava)
//      pnpm migracao:run --commit   (grava no Postgres alvo do DATABASE_URL)
//
// Idempotente: re-rodar não duplica (MigracaoAmplimedMap). Ordem FK:
// especialidade → user+profissional → cidadão → slot+consulta+nota+diagnóstico.
// Resolução cruzada via mapas em memória (funciona em dry-run e em resume).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { abrirOrigem } from "./origem";
import { registrarMapa } from "./mapa";
import { PROFISSIONAIS_CURADOS, ADMIN_CODUS } from "./profissionais-curados";
import { mapUsuarioParaProfissional } from "../../src/lib/migracao-amplimed/profissional";
import { mapPacienteParaCidadao } from "../../src/lib/migracao-amplimed/cidadao";
import { mapConsultaParaNota, horaSinteticaSlot } from "../../src/lib/migracao-amplimed/consulta";
import { parseDataNascimento } from "../../src/lib/migracao-amplimed/datas";

const COMMIT = process.argv.includes("--commit");
const UNIT = "medico";
const DURACAO_PADRAO_MIN = 30;
const COR_DESTAQUE = "#007571"; // acento médico do brandbook; Erick recolore depois

const db = new PrismaClient();
const origem = await abrirOrigem();
const log = (m: string) => console.log(`${COMMIT ? "[COMMIT]" : "[DRY-RUN]"} ${m}`);

// Idempotência por RESUME: pré-carrega a proveniência uma vez (O(1) lookup),
// em vez de um findUnique por registro (~113k round-trips). Dentro de UM run
// nada é visitado 2x, então isto cobre só re-execuções.
const mapaExistente = new Map<string, string>();
{
  const rows = await db.migracaoAmplimedMap.findMany({
    select: { entidade: true, idOrigem: true, idDestino: true },
  });
  for (const r of rows) mapaExistente.set(`${r.entidade}|${r.idOrigem}`, r.idDestino);
}
const jaFeito = (entidade: string, idOrigem: string | number): string | null =>
  mapaExistente.get(`${entidade}|${String(idOrigem)}`) ?? null;

type ProfRef = { profId: string; especialidadeId: string; userId: string };
const profPorCodu = new Map<number, ProfRef>();
const cidadaoPorCodp = new Map<number, string>();

function senhaAleatoria(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

async function userMigracao(): Promise<string> {
  const email = "migracao.amplimed@familiaponcio.org.br";
  const existe = await db.user.findUnique({ where: { email } });
  if (existe) return existe.id;
  if (!COMMIT) return "DRY-USER";
  const u = await db.user.create({
    data: {
      email,
      name: "Migração Amplimed",
      mustChangePassword: true,
      hashedPassword: await bcrypt.hash(senhaAleatoria(), 10),
    },
  });
  return u.id;
}

// ── Profissionais (só os referenciados por consulta, exclui admin) ───────────
async function carregarProfissionais(): Promise<void> {
  const usuarios = await origem.usuarios();
  const porCodu = new Map(usuarios.map((u) => [u.codu, u]));
  const espCache = new Map<string, string>();

  async function especialidadeId(nome: string): Promise<string> {
    const cached = espCache.get(nome);
    if (cached) return cached;
    let id = `DRY-esp-${nome}`;
    if (COMMIT) {
      const esp = await db.especialidade.upsert({
        where: { nome },
        update: {},
        create: { nome, duracaoPadraoMin: DURACAO_PADRAO_MIN, corDestaque: COR_DESTAQUE },
      });
      id = esp.id;
    }
    espCache.set(nome, id);
    return id;
  }

  let ok = 0;
  let pulados = 0;
  let falhas = 0;
  for (const [coduStr, curado] of Object.entries(PROFISSIONAIS_CURADOS)) {
    const codu = Number(coduStr);
    if (ADMIN_CODUS.has(codu)) {
      pulados++;
      continue;
    }
    const src = porCodu.get(codu);
    if (!src) {
      pulados++;
      continue;
    }
    try {
      const espId = await especialidadeId(curado.especialidade);

      const existente = jaFeito("profissional", codu);
      if (existente) {
        const prof = await db.profissional.findUnique({
          where: { id: existente },
          include: { especialidades: true },
        });
        profPorCodu.set(codu, {
          profId: existente,
          especialidadeId: prof?.especialidades[0]?.especialidadeId ?? espId,
          userId: prof?.userId ?? "",
        });
        ok++;
        continue;
      }

      const m = mapUsuarioParaProfissional(src);
      if (!COMMIT) {
        profPorCodu.set(codu, {
          profId: `DRY-prof-${codu}`,
          especialidadeId: espId,
          userId: `DRY-user-${codu}`,
        });
        ok++;
        continue;
      }

      const user =
        (await db.user.findUnique({ where: { email: m.email } })) ??
        (await db.user.create({
          data: {
            email: m.email,
            name: curado.nomeExibicao,
            mustChangePassword: true,
            hashedPassword: await bcrypt.hash(senhaAleatoria(), 10),
          },
        }));
      const prof = await db.profissional.create({
        data: {
          userId: user.id,
          nomeExibicao: curado.nomeExibicao,
          conselho: m.conselho,
          nroConselho: m.nroConselho,
          especialidades: { create: [{ especialidadeId: espId }] },
        },
      });
      await registrarMapa(db, "profissional", codu, prof.id);
      profPorCodu.set(codu, { profId: prof.id, especialidadeId: espId, userId: user.id });
      ok++;
    } catch (e) {
      falhas++;
      log(`  falha profissional codu=${codu}: ${(e as Error).message}`);
    }
  }
  log(
    `profissionais: ${ok} ok · ${pulados} pulados · ${falhas} falhas · especialidades: ${espCache.size}`,
  );
}

// ── Cidadãos (migra TODOS; dedup CPF nulando duplicado, preserva o registro) ──
async function carregarCidadaos(migradorId: string): Promise<void> {
  const pacientes = await origem.pacientes();
  const vistosCpf = new Set<string>();
  let ok = 0;
  let falhas = 0;
  let dupCpf = 0;
  let semNome = 0;
  let comProblema = 0;
  for (const row of pacientes) {
    try {
      const c = mapPacienteParaCidadao(row);
      if (c.problemas.length) comProblema++;
      if (c.nomeCompleto === "(nome não informado)") semNome++;

      let cpf = c.cpf;
      if (cpf && vistosCpf.has(cpf)) {
        cpf = null; // duplicado: nula p/ não violar @unique, mas mantém o registro
        dupCpf++;
      } else if (cpf) {
        vistosCpf.add(cpf);
      }

      const existente = jaFeito("cidadao", row.codp);
      if (existente) {
        cidadaoPorCodp.set(row.codp, existente);
        ok++;
        continue;
      }
      if (!COMMIT) {
        cidadaoPorCodp.set(row.codp, `DRY-cid-${row.codp}`);
        ok++;
        continue;
      }

      const cidadao = await db.cidadao.create({
        data: {
          nomeCompleto: c.nomeCompleto,
          cpf,
          dataNascimento: c.dataNascimento,
          telefonePrincipal: c.telefonePrincipal,
          telefoneSecundario: c.telefoneSecundario,
          email: c.email,
          genero: c.genero,
          corRaca: c.corRaca,
          nomeMae: c.nomeMae,
          nomePai: c.nomePai,
          tipoSanguineo: c.tipoSanguineo,
          alergias: c.alergias,
          rg: row.rg?.trim() || null,
          unitIdOrigem: UNIT,
          createdById: migradorId,
          statusCadastro: "ativo",
          enderecos: c.endereco
            ? {
                create: [
                  {
                    tipo: "residencial",
                    isPrincipal: true,
                    cep: c.endereco.cep,
                    logradouro: c.endereco.logradouro,
                    numero: c.endereco.numero,
                    bairro: c.endereco.bairro,
                    cidade: c.endereco.cidade,
                    uf: c.endereco.uf,
                  },
                ],
              }
            : undefined,
        },
      });
      await registrarMapa(db, "cidadao", row.codp, cidadao.id);
      cidadaoPorCodp.set(row.codp, cidadao.id);
      ok++;
    } catch (e) {
      falhas++;
      if (falhas <= 5) log(`  falha cidadão codp=${row.codp}: ${(e as Error).message}`);
    }
  }
  log(
    `cidadãos: ${ok} ok · ${falhas} falhas · ${dupCpf} CPF dup nulado · ${semNome} sem nome · ${comProblema} c/ problema(s)`,
  );
}

// ── Consultas → Slot sintético + Consulta + Nota assinada + Diagnósticos ─────
async function carregarConsultas(migradorId: string): Promise<void> {
  const consultas = (await origem.consultas())
    .filter((c) => c.dtconsulta && c.dtconsulta.trim())
    .sort((a, b) => {
      const da = a.dtconsulta ?? "";
      const dbb = b.dtconsulta ?? "";
      return da < dbb ? -1 : da > dbb ? 1 : a.codcon - b.codcon;
    });
  const ordemPorChave = new Map<string, number>();
  let ok = 0;
  let semCidadao = 0;
  let semProf = 0;
  let semData = 0;
  let falhas = 0;
  for (const row of consultas) {
    try {
      const cidadaoId = cidadaoPorCodp.get(row.codp);
      const profRef = profPorCodu.get(row.codu);
      if (!cidadaoId) {
        semCidadao++;
        continue;
      }
      if (!profRef) {
        semProf++;
        continue;
      }
      const { data: dia } = parseDataNascimento(row.dtconsulta);
      if (!dia) {
        semData++;
        continue;
      }

      const chave = `${row.codu}|${row.dtconsulta}`;
      const ordem = ordemPorChave.get(chave) ?? 0;
      ordemPorChave.set(chave, ordem + 1);

      const existente = jaFeito("consulta", row.codcon);
      if (existente) {
        ok++;
        continue;
      }
      if (!COMMIT) {
        ok++;
        continue;
      }

      const dataHoraInicio = horaSinteticaSlot(dia, ordem, DURACAO_PADRAO_MIN);
      const nota = mapConsultaParaNota(row);

      await db.$transaction(async (tx) => {
        const slot = await tx.slot.create({
          data: {
            profissionalId: profRef.profId,
            especialidadeId: profRef.especialidadeId,
            dataHoraInicio,
            duracaoMin: DURACAO_PADRAO_MIN,
            status: "realizado",
          },
        });
        const consulta = await tx.consulta.create({
          data: {
            slotId: slot.id,
            cidadaoId,
            profissionalId: profRef.profId,
            especialidadeId: profRef.especialidadeId,
            status: "realizada",
            createdBy: migradorId,
          },
        });
        const notaCriada = await tx.notaEvolucao.create({
          data: {
            consultaId: consulta.id,
            cidadaoId,
            profissionalId: profRef.profId,
            texto: nota.texto,
            paSistolica: nota.paSistolica,
            paDiastolica: nota.paDiastolica,
            fcBpm: nota.fcBpm,
            frIrpm: nota.frIrpm,
            tempC: nota.tempC,
            pesoKg: nota.pesoKg,
            alturaCm: nota.alturaCm,
            status: "assinada",
            assinadaEm: dataHoraInicio,
            assinadaPor: profRef.userId,
            diagnosticos: {
              create: nota.diagnosticos.map((d) => ({
                codigoCid: d.codigoCid,
                descricao: d.descricao,
                principal: d.principal,
              })),
            },
          },
        });
        await registrarMapa(tx, "consulta", row.codcon, consulta.id);
        await registrarMapa(tx, "nota", row.codcon, notaCriada.id);
      });
      ok++;
    } catch (e) {
      falhas++;
      if (falhas <= 10) log(`  falha consulta codcon=${row.codcon}: ${(e as Error).message}`);
    }
  }
  log(
    `consultas: ${ok} ok · ${semCidadao} sem cidadão · ${semProf} sem prof · ${semData} sem data · ${falhas} falhas`,
  );
}

// ── Orquestração ────────────────────────────────────────────────────────────
console.log(
  `\n=== MIGRAÇÃO AMPLIMED → IFP — ${COMMIT ? "COMMIT (grava)" : "DRY-RUN (nada grava)"} ===`,
);
const migradorId = await userMigracao();
await carregarProfissionais();
await carregarCidadaos(migradorId);
await carregarConsultas(migradorId);
await origem.fechar();
await db.$disconnect();
console.log("=== FIM ===\n");
