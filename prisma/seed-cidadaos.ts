/**
 * Seed de famílias + cidadãos exemplo pra demo IFP Connect.
 *
 * Dados FICTÍCIOS — CPFs válidos algoritmicamente (sem dono real),
 * endereços em Duque de Caxias/RJ (sede do IFP), distribuição realista
 * entre as 4 unidades. Inclui Família Almeida (mencionada nos mocks
 * de /app/social).
 */

import type { PrismaClient } from "@prisma/client";
import type { UnitScope } from "../src/lib/rbac-types";

/**
 * Gera CPF válido determinístico a partir de uma seed string.
 * Mesmo seed sempre produz mesmo CPF (idempotência pra re-seed).
 */
function generateValidCpf(seed: string): string {
  let hash = 0;
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  let nineDigits = String(hash).padStart(9, "0").slice(-9);

  // Evita todos dígitos iguais (RFB rejeita)
  if (/^(\d)\1{8}$/.test(nineDigits)) {
    nineDigits = `${nineDigits.slice(0, 8)}${(parseInt(nineDigits.charAt(0), 10) + 1) % 10}`;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(nineDigits.charAt(i), 10) * (10 - i);
  let d10 = (sum * 10) % 11;
  if (d10 >= 10) d10 = 0;

  sum = 0;
  const tenDigits = nineDigits + d10;
  for (let i = 0; i < 10; i++) sum += parseInt(tenDigits.charAt(i), 10) * (11 - i);
  let d11 = (sum * 10) % 11;
  if (d11 >= 10) d11 = 0;

  return tenDigits + d11;
}

interface FamiliaSpec {
  nomeReferencia: string;
  observacoes?: string;
  cidadaos: CidadaoSpec[];
}

interface CidadaoSpec {
  nomeCompleto: string;
  /** YYYY-MM-DD */
  dataNascimento: string;
  telefone: string;
  unidade: UnitScope;
  /** Sobrescreve gênero opcional */
  genero?: string;
  rendaFamiliar?: number;
  beneficioSocial?: string;
  endereco?: {
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
  // Saúde (só pra cidadãos com unidade médico)
  tipoSanguineo?: string;
  condicoesCronicas?: string;
}

const FAMILIAS: FamiliaSpec[] = [
  {
    nomeReferencia: "Família Almeida",
    observacoes: "Família referenciada pelo CRAS Duque de Caxias — vulnerabilidade alta.",
    cidadaos: [
      {
        nomeCompleto: "Maria das Graças Almeida",
        dataNascimento: "1978-03-12",
        telefone: "(21) 99876-5432",
        unidade: "medico",
        genero: "feminino",
        rendaFamiliar: 1320,
        beneficioSocial: "bolsa_familia",
        endereco: {
          cep: "25010-000",
          logradouro: "Rua General Olímpio Mourão Filho",
          numero: "245",
          bairro: "Centro",
          cidade: "Duque de Caxias",
          uf: "RJ",
        },
        tipoSanguineo: "O+",
        condicoesCronicas: "Hipertensão controlada",
      },
      {
        nomeCompleto: "José Roberto Almeida",
        dataNascimento: "1975-11-04",
        telefone: "(21) 98765-4321",
        unidade: "medico",
        genero: "masculino",
        endereco: {
          cep: "25010-000",
          logradouro: "Rua General Olímpio Mourão Filho",
          numero: "245",
          bairro: "Centro",
          cidade: "Duque de Caxias",
          uf: "RJ",
        },
        tipoSanguineo: "A+",
      },
    ],
  },
  {
    nomeReferencia: "Família Silva",
    cidadaos: [
      {
        nomeCompleto: "Ana Beatriz Silva",
        dataNascimento: "2008-07-22",
        telefone: "(21) 97654-3210",
        unidade: "capacitacao",
        genero: "feminino",
        endereco: {
          cep: "25020-130",
          logradouro: "Avenida Presidente Kennedy",
          numero: "1024",
          bairro: "Jardim Primavera",
          cidade: "Duque de Caxias",
          uf: "RJ",
        },
      },
      {
        nomeCompleto: "Carla Regina Silva",
        dataNascimento: "1982-05-14",
        telefone: "(21) 96543-2109",
        unidade: "capacitacao",
        genero: "feminino",
        rendaFamiliar: 1800,
        endereco: {
          cep: "25020-130",
          logradouro: "Avenida Presidente Kennedy",
          numero: "1024",
          bairro: "Jardim Primavera",
          cidade: "Duque de Caxias",
          uf: "RJ",
        },
      },
    ],
  },
  {
    nomeReferencia: "Família Costa",
    observacoes: "Documentação de Bolsa Família incompleta — pendente regularização.",
    cidadaos: [
      {
        nomeCompleto: "Pedro Henrique Costa",
        dataNascimento: "2012-09-30",
        telefone: "(21) 95432-1098",
        unidade: "esportivo",
        genero: "masculino",
        endereco: {
          cep: "25055-090",
          logradouro: "Rua Saracuruna",
          numero: "78",
          bairro: "Saracuruna",
          cidade: "Duque de Caxias",
          uf: "RJ",
        },
      },
    ],
  },
  {
    nomeReferencia: "Família Souza",
    cidadaos: [
      {
        nomeCompleto: "Luiza Fernanda Souza",
        dataNascimento: "2015-02-18",
        telefone: "(21) 94321-0987",
        unidade: "recreativo",
        genero: "feminino",
        endereco: {
          cep: "25065-120",
          logradouro: "Rua Imbariê",
          numero: "412",
          bairro: "Imbariê",
          cidade: "Duque de Caxias",
          uf: "RJ",
        },
      },
      {
        nomeCompleto: "Patrícia Helena Souza",
        dataNascimento: "1985-12-03",
        telefone: "(21) 93210-9876",
        unidade: "recreativo",
        genero: "feminino",
        rendaFamiliar: 980,
        beneficioSocial: "bpc",
      },
    ],
  },
  {
    nomeReferencia: "Família Pereira",
    cidadaos: [
      {
        nomeCompleto: "Marcos Vinícius Pereira",
        dataNascimento: "2010-04-25",
        telefone: "(21) 92109-8765",
        unidade: "esportivo",
        genero: "masculino",
      },
      {
        nomeCompleto: "Antônia Pereira",
        dataNascimento: "1955-08-09",
        telefone: "(21) 91098-7654",
        unidade: "medico",
        genero: "feminino",
        tipoSanguineo: "B+",
        condicoesCronicas: "Diabetes tipo 2",
      },
    ],
  },
  {
    nomeReferencia: "Família Oliveira",
    cidadaos: [
      {
        nomeCompleto: "Rafael Augusto Oliveira",
        dataNascimento: "1995-06-17",
        telefone: "(21) 99888-7777",
        unidade: "capacitacao",
        genero: "masculino",
        beneficioSocial: "nenhum",
      },
    ],
  },
  {
    nomeReferencia: "Família Santos",
    cidadaos: [
      {
        nomeCompleto: "Joana D'Arc Santos",
        dataNascimento: "1968-01-15",
        telefone: "(21) 98777-6666",
        unidade: "medico",
        genero: "feminino",
        tipoSanguineo: "O-",
      },
      {
        nomeCompleto: "Gabriel Santos Filho",
        dataNascimento: "2013-10-08",
        telefone: "(21) 97666-5555",
        unidade: "recreativo",
        genero: "masculino",
      },
    ],
  },
  {
    nomeReferencia: "Família Rodrigues",
    cidadaos: [
      {
        nomeCompleto: "Camila Rodrigues",
        dataNascimento: "2006-11-29",
        telefone: "(21) 96555-4444",
        unidade: "capacitacao",
        genero: "feminino",
      },
    ],
  },
  {
    nomeReferencia: "Família Lima",
    cidadaos: [
      {
        nomeCompleto: "Eduardo Lima Júnior",
        dataNascimento: "2009-03-07",
        telefone: "(21) 95444-3333",
        unidade: "esportivo",
        genero: "masculino",
      },
    ],
  },
  {
    nomeReferencia: "Família Carvalho",
    cidadaos: [
      {
        nomeCompleto: "Beatriz Carvalho Mendes",
        dataNascimento: "1992-09-21",
        telefone: "(21) 94333-2222",
        unidade: "capacitacao",
        genero: "feminino",
        rendaFamiliar: 2400,
      },
    ],
  },
];

export async function seedCidadaos(db: PrismaClient, createdById: string) {
  let cidadaosCount = 0;
  for (const spec of FAMILIAS) {
    // Upsert família por nome de referência (não é unique no schema, então
    // usamos findFirst + create idempotente)
    const familiaExistente = await db.familia.findFirst({
      where: { nomeReferencia: spec.nomeReferencia },
    });
    const familia =
      familiaExistente ??
      (await db.familia.create({
        data: {
          nomeReferencia: spec.nomeReferencia,
          observacoes: spec.observacoes,
        },
      }));

    for (const c of spec.cidadaos) {
      const cpf = generateValidCpf(`${c.nomeCompleto}-${c.dataNascimento}`);
      await db.cidadao.upsert({
        where: { cpf },
        update: {},
        create: {
          nomeCompleto: c.nomeCompleto,
          cpf,
          dataNascimento: new Date(c.dataNascimento),
          telefonePrincipal: c.telefone,
          genero: c.genero,
          rendaFamiliar: c.rendaFamiliar,
          beneficioSocial: c.beneficioSocial,
          tipoSanguineo: c.tipoSanguineo,
          condicoesCronicas: c.condicoesCronicas,
          unitIdOrigem: c.unidade,
          familiaId: familia.id,
          createdById,
          ...(c.endereco && {
            enderecos: {
              create: [
                {
                  tipo: "residencial",
                  cep: c.endereco.cep.replace(/\D/g, ""),
                  logradouro: c.endereco.logradouro,
                  numero: c.endereco.numero,
                  bairro: c.endereco.bairro,
                  cidade: c.endereco.cidade,
                  uf: c.endereco.uf,
                  isPrincipal: true,
                },
              ],
            },
          }),
        },
      });
      cidadaosCount++;
    }
  }
  console.log(`Seeded ${FAMILIAS.length} famílias com ${cidadaosCount} cidadãos`);
}
