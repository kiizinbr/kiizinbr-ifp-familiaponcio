// Migração Amplimed → IFP Connect — Mídia (T15).
// Uso: pnpm migracao:midia [--commit] [--so=foto|anexo]
//   foto  = pacientes.fotopac (ZIP fotospac)  → Cidadao.fotoUrl
//   anexo = pacsimg.endimg   (ZIP fotospron)  → AnexoCidadao (categoria saude)
// Sem --so faz os dois. Idempotente (MigracaoAmplimedMap entidade 'foto'/'anexo').
// Vínculo: basename(URL S3) == basename da entrada no ZIP (fallback por stem p/ jpg↔jpeg).
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import * as Minio from "minio";
import StreamZip from "node-stream-zip";
import { abrirOrigem } from "./origem";
import { registrarMapa } from "./mapa";
import {
  ehUrlMidiaReal,
  basenameMidia,
  stemDeBasename,
  mimePorBasename,
} from "../../src/lib/migracao-amplimed/midia";

const COMMIT = process.argv.includes("--commit");
const SO = process.argv.find((a) => a.startsWith("--so="))?.slice(5);
const fazerFotos = !SO || SO === "foto";
const fazerAnexos = !SO || SO === "anexo";

const ZIPDIR = process.env.MIGRACAO_ZIPDIR ?? "/mnt/c/Dev/ifp-connect/backup-amplimed";
const PREFIXO = "6a22ea018b938404430e2312_media_2026_06_06_03_30_41";
const ZIP_FOTOSPAC = [`amplimedfotospac_${PREFIXO}_part1.zip`];
const ZIP_FOTOSPRON = [
  `amplimedfotospron_${PREFIXO}_part1.zip`,
  `amplimedfotospron_${PREFIXO}_part2.zip`,
  `amplimedfotospron_${PREFIXO}_part3.zip`,
];

const db = new PrismaClient();
const origem = await abrirOrigem();
const log = (m: string) => console.log(`${COMMIT ? "[COMMIT]" : "[DRY-RUN]"} ${m}`);

const BUCKET = process.env.MINIO_BUCKET_CIDADAO ?? "ifp-cidadao-anexos";
const minio = new Minio.Client({
  endPoint: process.env.MINIO_HOST ?? "localhost",
  port: Number(process.env.MINIO_PORT ?? 9000),
  useSSL: (process.env.MINIO_USE_SSL ?? "false") === "true",
  accessKey: process.env.MINIO_ACCESS_KEY ?? "",
  secretKey: process.env.MINIO_SECRET_KEY ?? "",
});

// codp → cidadaoId (proveniência do core) + idempotência da mídia.
const cidadaoPorCodp = new Map<number, string>();
const jaMidia = new Set<string>();
{
  const cid = await db.migracaoAmplimedMap.findMany({
    where: { entidade: "cidadao" },
    select: { idOrigem: true, idDestino: true },
  });
  for (const r of cid) cidadaoPorCodp.set(Number(r.idOrigem), r.idDestino);
  const mid = await db.migracaoAmplimedMap.findMany({
    where: { entidade: { in: ["foto", "anexo"] } },
    select: { entidade: true, idOrigem: true },
  });
  for (const r of mid) jaMidia.add(`${r.entidade}|${r.idOrigem}`);
}

async function userMigradorId(): Promise<string> {
  const u = await db.user.findUnique({
    where: { email: "migracao.amplimed@familiaponcio.org.br" },
  });
  if (!u) throw new Error("user migrador inexistente — rode `pnpm migracao:run --commit` antes");
  return u.id;
}

// ── Índice do ZIP: basename/stem → {zi, entry, size} ─────────────────────────
interface RefArquivo {
  zi: number;
  entry: string;
  size: number;
}
interface Indice {
  zips: StreamZip.StreamZipAsync[];
  resolver(basename: string | null): RefArquivo | null;
  ler(ref: RefArquivo): Promise<Buffer>;
  total: number;
  fechar(): Promise<void>;
}

async function abrirIndice(arquivos: string[]): Promise<Indice> {
  const zips: StreamZip.StreamZipAsync[] = [];
  const porBasename = new Map<string, RefArquivo>();
  const porStem = new Map<string, RefArquivo>();
  for (const f of arquivos) {
    const zip = new StreamZip.async({ file: `${ZIPDIR}/${f}` });
    const zi = zips.push(zip) - 1;
    const entries = await zip.entries();
    for (const e of Object.values(entries)) {
      if (e.isDirectory) continue;
      const bn = basenameMidia(e.name);
      if (!bn) continue;
      const ref: RefArquivo = { zi, entry: e.name, size: e.size };
      porBasename.set(bn, ref);
      const st = stemDeBasename(bn);
      if (st) porStem.set(st, ref);
    }
  }
  return {
    zips,
    total: porBasename.size,
    resolver(basename) {
      if (!basename) return null;
      return porBasename.get(basename) ?? porStem.get(stemDeBasename(basename) ?? "") ?? null;
    },
    async ler(ref) {
      const zip = zips[ref.zi];
      if (!zip) throw new Error(`zip index ${ref.zi} inexistente`);
      return zip.entryData(ref.entry);
    },
    async fechar() {
      for (const z of zips) await z.close();
    },
  };
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

// ── Fotos do paciente → Cidadao.fotoUrl ──────────────────────────────────────
async function carregarFotos(): Promise<void> {
  const idx = await abrirIndice(ZIP_FOTOSPAC);
  log(`índice fotospac: ${idx.total} arquivos`);
  const fotos = await origem.fotosPaciente();
  let ok = 0,
    placeholder = 0,
    semCidadao = 0,
    semArquivo = 0,
    ja = 0,
    falhas = 0;
  for (const { codp, fotopac } of fotos) {
    try {
      if (!ehUrlMidiaReal(fotopac)) {
        placeholder++;
        continue;
      }
      const cidadaoId = cidadaoPorCodp.get(codp);
      if (!cidadaoId) {
        semCidadao++;
        continue;
      }
      const bn = basenameMidia(fotopac);
      const ref = idx.resolver(bn);
      if (!ref || !bn) {
        semArquivo++;
        continue;
      }
      if (jaMidia.has(`foto|${codp}`)) {
        ja++;
        ok++;
        continue;
      }
      if (!COMMIT) {
        ok++;
        continue;
      }
      const mime = mimePorBasename(bn) ?? "image/png";
      const storageKey = `${cidadaoId}/foto-${bn}`;
      const buf = await idx.ler(ref);
      await minio.putObject(BUCKET, storageKey, buf, buf.length, { "Content-Type": mime });
      await db.cidadao.update({ where: { id: cidadaoId }, data: { fotoUrl: storageKey } });
      await registrarMapa(db, "foto", codp, storageKey);
      ok++;
    } catch (e) {
      falhas++;
      if (falhas <= 5) log(`  falha foto codp=${codp}: ${(e as Error).message}`);
    }
  }
  await idx.fechar();
  log(
    `fotos: ${ok} ok (${ja} já) · ${placeholder} placeholder · ${semCidadao} sem cidadão · ${semArquivo} sem arquivo · ${falhas} falhas`,
  );
}

// ── Imagens de prontuário (pacsimg) → AnexoCidadao (saude) ───────────────────
async function carregarAnexos(migradorId: string): Promise<void> {
  const idx = await abrirIndice(ZIP_FOTOSPRON);
  log(`índice fotospron: ${idx.total} arquivos`);
  const imgs = await origem.pacsimg();
  let ok = 0,
    semCidadao = 0,
    semArquivo = 0,
    mimeRuim = 0,
    ja = 0,
    falhas = 0;
  for (const row of imgs) {
    try {
      const cidadaoId = row.codp != null ? cidadaoPorCodp.get(row.codp) : undefined;
      if (!cidadaoId) {
        semCidadao++;
        continue;
      }
      const bn = basenameMidia(row.endimg);
      const ref = idx.resolver(bn);
      if (!ref || !bn) {
        semArquivo++;
        continue;
      }
      const mime = mimePorBasename(bn);
      if (!mime) {
        mimeRuim++;
        continue;
      }
      if (jaMidia.has(`anexo|${row.codimg}`)) {
        ja++;
        ok++;
        continue;
      }
      if (!COMMIT) {
        ok++;
        continue;
      }
      const storageKey = `${cidadaoId}/anexo-${row.codimg}-${bn}`;
      const buf = await idx.ler(ref);
      await minio.putObject(BUCKET, storageKey, buf, buf.length, { "Content-Type": mime });
      const descricao =
        [row.legenda?.trim() || null, row.datacad ? `Amplimed ${row.datacad}` : null]
          .filter(Boolean)
          .join(" · ") || null;
      const anexo = await db.anexoCidadao.create({
        data: {
          cidadaoId,
          fileName: bn,
          mimeType: mime,
          sizeBytes: buf.length,
          hashSha256: sha256(buf),
          storageKey,
          descricao,
          categoria: "saude",
          uploadedById: migradorId,
        },
      });
      await registrarMapa(db, "anexo", row.codimg, anexo.id);
      ok++;
    } catch (e) {
      falhas++;
      if (falhas <= 10) log(`  falha anexo codimg=${row.codimg}: ${(e as Error).message}`);
    }
  }
  await idx.fechar();
  log(
    `anexos: ${ok} ok (${ja} já) · ${semCidadao} sem cidadão · ${semArquivo} sem arquivo · ${mimeRuim} mime ruim · ${falhas} falhas`,
  );
}

// ── Orquestração ─────────────────────────────────────────────────────────────
console.log(
  `\n=== MIGRAÇÃO MÍDIA AMPLIMED → IFP — ${COMMIT ? "COMMIT" : "DRY-RUN"}${SO ? ` (só ${SO})` : ""} ===`,
);
if (COMMIT) {
  const existe = await minio.bucketExists(BUCKET).catch(() => false);
  if (!existe) await minio.makeBucket(BUCKET);
}
const migradorId = COMMIT ? await userMigradorId() : "DRY-USER";
if (fazerFotos) await carregarFotos();
if (fazerAnexos) await carregarAnexos(migradorId);
await origem.fechar();
await db.$disconnect();
console.log("=== FIM ===\n");
