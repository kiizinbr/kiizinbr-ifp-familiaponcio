/**
 * "Novo paciente" no passo 1 do wizard /medico/consultas/nova.
 *
 * Form mínimo (nome, CPF, data nascimento, telefone) — o suficiente pra destravar
 * o agendamento quando a ficha ainda não existe. A criação em si REUSA
 * createCidadaoAction / cidadaoCreateSchema (sem duplicar regra): este schema só
 * valida o subconjunto digitado aqui e o mapper completa o CidadaoCreateInput
 * (unitIdOrigem=medico, sem endereços). A ficha completa é editada depois em
 * /app/cidadaos/[id].
 */

import { z } from "zod";
import { normalizeCpf, validateCpf } from "@/lib/cpf";
import type { CidadaoCreateInput } from "@/lib/cidadao-schema";

const nomeSchema = z.string().trim().min(1, { message: "Nome completo obrigatório" });

const telefoneSchema = z.string().trim().min(1, { message: "Telefone principal obrigatório" });

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

const dataNascimentoSchema = z
  .string()
  .min(1, { message: "Data de nascimento obrigatória" })
  .pipe(z.string().date({ message: "Data inválida (use AAAA-MM-DD)" }));

export const novoPacienteSchema = z.object({
  nomeCompleto: nomeSchema,
  cpf: cpfSchema,
  dataNascimento: dataNascimentoSchema,
  telefonePrincipal: telefoneSchema,
});

export type NovoPacienteInput = z.input<typeof novoPacienteSchema>;
export type NovoPacienteData = z.output<typeof novoPacienteSchema>;

/**
 * Pura: converte o form mínimo no CidadaoCreateInput consumido por
 * createCidadaoAction. Fixa unitIdOrigem=medico e sem endereços (preenchidos
 * depois na ficha completa). NÃO toca o banco — testável sem DB.
 */
export function novoPacienteParaCidadaoInput(data: NovoPacienteData): CidadaoCreateInput {
  return {
    nomeCompleto: data.nomeCompleto,
    cpf: data.cpf,
    dataNascimento: data.dataNascimento,
    telefonePrincipal: data.telefonePrincipal,
    // rendaFamiliar/pessoasNaCasa exigem a CHAVE presente no cidadaoCreateSchema
    // (a união aceita "" → undefined, mas não a ausência da chave). Mandamos ""
    // igual ao form completo de /app/cidadaos/novo — preenchido depois na ficha.
    rendaFamiliar: "",
    pessoasNaCasa: "",
    unitIdOrigem: "medico",
    enderecos: [],
  };
}
