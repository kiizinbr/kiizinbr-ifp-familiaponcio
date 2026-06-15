/**
 * Schemas Zod pra validação de Ficha Cidadã (Plano 3).
 *
 * Reflete decisão §0.1: 4 obrigatórios + 23 opcionais + 7 sistema.
 * Validação inline campo-a-campo no client + final no Server Action.
 */

import { z } from "zod";
import { normalizeCpf, validateCpf } from "@/lib/cpf";
import { normalizeCep } from "@/lib/cep";
import { normalizeTipoSanguineo } from "@/lib/tipo-sanguineo";

const trimmedString = (label?: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(
      z
        .string({ message: `${label ?? "Campo"} obrigatório` })
        .min(1, { message: `${label ?? "Campo"} obrigatório` }),
    );

const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const optionalEmail = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .pipe(z.string().email({ message: "E-mail inválido" }).optional())
  .optional();

const cpfSchema = z
  .string()
  .trim()
  .transform((v) => normalizeCpf(v))
  .pipe(
    z
      .string()
      .length(11, { message: "CPF deve ter 11 dígitos" })
      .refine((v) => validateCpf(v), { message: "CPF inválido (dígito verificador errado)" }),
  );

const cepSchema = z
  .string()
  .trim()
  .transform((v) => normalizeCep(v))
  .pipe(z.string().length(8, { message: "CEP deve ter 8 dígitos" }));

const unitScopeSchema = z.enum(["medico", "capacitacao", "esportivo", "recreativo"]);

export const enderecoSchema = z.object({
  tipo: z.enum(["residencial", "trabalho", "contato"]).default("residencial"),
  cep: cepSchema,
  logradouro: trimmedString("Logradouro"),
  numero: optionalString,
  complemento: optionalString,
  bairro: optionalString,
  cidade: trimmedString("Cidade"),
  uf: z.string().trim().length(2, { message: "UF deve ter 2 letras" }).toUpperCase(),
  pontoReferencia: optionalString,
  isPrincipal: z.boolean().default(true),
});

export const cidadaoCreateSchema = z.object({
  // Obrigatórios
  nomeCompleto: trimmedString("Nome completo"),
  cpf: cpfSchema,
  dataNascimento: z
    .string()
    .min(1, { message: "Data de nascimento obrigatória" })
    .pipe(z.string().date({ message: "Data inválida (use AAAA-MM-DD)" }))
    // F11: faixa plausível (Zod, NÃO schema do banco). O .pipe(.date()) já
    // garantiu o formato AAAA-MM-DD; aqui só rejeitamos data futura ou idade
    // implausível (> 130 anos). Cobre create E update (schema único).
    .refine(
      (s) => {
        const d = new Date(`${s}T00:00:00`); // local, evita off-by-one de fuso
        if (Number.isNaN(d.getTime())) return false;
        // Compara em granularidade de DIA (d é meia-noite): zera a hora dos
        // limites pra borda de 130 anos ser inclusiva, sem depender do horário.
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        if (d > hoje) return false; // não futura (nascido hoje é válido)
        const min = new Date();
        min.setHours(0, 0, 0, 0);
        min.setFullYear(min.getFullYear() - 130); // <= 130 anos
        return d >= min;
      },
      { message: "Data de nascimento implausível (0-130 anos, não futura)" },
    ),
  telefonePrincipal: trimmedString("Telefone principal"),

  // Identificação opcional
  nomeSocial: optionalString,
  rg: optionalString,
  documentoAlternativo: optionalString,
  genero: z.enum(["feminino", "masculino", "nao_binario", "nao_informar"]).optional(),
  corRaca: z.enum(["branca", "preta", "parda", "amarela", "indigena"]).optional(),
  estadoCivil: optionalString,
  nacionalidade: optionalString,
  naturalidade: optionalString,
  nomeMae: optionalString,
  nomePai: optionalString,
  escolaAtual: optionalString,

  // Contato opcional
  telefoneSecundario: optionalString,
  email: optionalEmail,
  whatsappConsente: z.boolean().default(false),

  // Socioeconômico (Plano 3 §0.5)
  rendaFamiliar: z
    .union([
      z.string().transform((v) => (v === "" ? undefined : Number(v))),
      z.number(),
      z.undefined(),
    ])
    .pipe(z.number().nonnegative().optional()),
  pessoasNaCasa: z
    .union([
      z.string().transform((v) => (v === "" ? undefined : Number(v))),
      z.number(),
      z.undefined(),
    ])
    .pipe(z.number().int().nonnegative().optional()),
  beneficioSocial: z.enum(["bolsa_familia", "bpc", "nenhum", "outro"]).optional(),
  escolaridade: optionalString,
  trabalha: z.boolean().optional(),
  trabalhoDescricao: optionalString,

  // Saúde (visível só pra médico — RBAC server-side)
  // B6: texto-livre migrado da Amplimed ("O Positivo", "o+"…) é normalizado pro
  // enum no boundary — sinônimo vira enum, lixo vira undefined (campo some, NÃO
  // trava o save). Schema do banco (String? livre) intocado; sem migration.
  tipoSanguineo: z.preprocess(
    (v) => (typeof v === "string" ? normalizeTipoSanguineo(v) : v),
    z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  ),
  alergias: optionalString,
  medicamentosEmUso: optionalString,
  condicoesCronicas: optionalString,

  // Sistema (não vem do form)
  unitIdOrigem: unitScopeSchema,
  enderecos: z.array(enderecoSchema).default([]),
  familiaId: z.string().optional(),
});

export type CidadaoCreateInput = z.input<typeof cidadaoCreateSchema>;
export type CidadaoCreateData = z.output<typeof cidadaoCreateSchema>;
export type EnderecoInput = z.input<typeof enderecoSchema>;

export const TABS = [
  { id: "identificacao", label: "Identificação", required: true },
  { id: "contato", label: "Contato", required: true },
  { id: "endereco", label: "Endereço", required: false },
  { id: "socio", label: "Socioeconômico", required: false },
  { id: "saude", label: "Saúde", required: false },
  { id: "anexos", label: "Anexos", required: false },
  { id: "familia", label: "Família", required: false },
] as const;

export type TabId = (typeof TABS)[number]["id"];
