"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileText,
  KeyRound,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  asOptions,
  ESCOLARIDADE_LABEL,
  ESTADO_CIVIL_LABEL,
  PARENTESCO_LABEL,
  PRIORIDADE_SINAL_LABEL,
  SITUACAO_MORADIA_LABEL,
  STATUS_ENCAMINHAMENTO_LABEL,
  STATUS_LABEL,
  TIPO_DOCUMENTO_LABEL,
  UNIDADES,
  type DocumentoFicha,
  type Elegibilidade,
  type Escolaridade,
  type EstadoCivil,
  type FichaDetalhe,
  type Membro,
  type Parentesco,
  type PrioridadeSinal,
  type StatusElegibilidade,
  type StatusEncaminhamento,
  type TipoDocumento,
} from "@/lib/api";
import {
  useAcessoFamilia,
  useFicha,
  useGerarAcessoFamilia,
  useReplaceMembros,
  useUpdateElegibilidade,
  useUpdateFicha,
  type AtualizarFichaPayload,
  type MembroPayload,
} from "@/lib/use-fichas";
import { useHistoricoEncaminhamentos } from "@/lib/use-encaminhamentos";
import {
  useBaixarDocumento,
  useDocumentos,
  useRemoverDocumento,
  useUploadDocumento,
} from "@/lib/use-documentos";
import {
  formatCpf,
  formatDataHora,
  formatDataISO,
  formatMoeda,
  formatTelefone,
  idadeAnos,
} from "@/lib/format";
import { cn } from "@/lib/cn";
import { Alerta, BadgeStatus, Botao, Campo, Select, Spinner, Textarea, Input } from "@/components/ui";

const statusOptions = asOptions(STATUS_LABEL);
const estadoCivilOptions = asOptions(ESTADO_CIVIL_LABEL);
const escolaridadeOptions = asOptions(ESCOLARIDADE_LABEL);
const parentescoOptions = asOptions(PARENTESCO_LABEL);

// Item de exibição rótulo/valor.
function Item({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children || "—"}</dd>
    </div>
  );
}

function Secao({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

/** Botão discreto "Editar" no canto de uma seção. */
function BotaoEditar({ onClick }: { onClick: () => void }) {
  return (
    <Botao type="button" variante="ghost" onClick={onClick} className="px-2 py-1 text-sm">
      <Pencil className="h-3.5 w-3.5" /> Editar
    </Botao>
  );
}

// ============================================================
// Edição inline do TITULAR (dados pessoais + contato + endereço)
// ============================================================
function FormularioTitular({
  ficha,
  onFechar,
}: {
  ficha: FichaDetalhe;
  onFechar: () => void;
}) {
  const mutation = useUpdateFicha();
  // Estado controlado de cada campo editável (CPF e protocolo ficam de fora: imutáveis).
  const [form, setForm] = useState({
    nomeCompleto: ficha.nomeCompleto,
    rg: ficha.rg ?? "",
    dataNascimento: ficha.dataNascimento.slice(0, 10),
    estadoCivil: ficha.estadoCivil ?? "",
    escolaridade: ficha.escolaridade ?? "",
    whatsappOptIn: ficha.whatsappOptIn,
    telefone: ficha.telefone ?? "",
    telefoneAlt: ficha.telefoneAlt ?? "",
    email: ficha.email ?? "",
    cep: ficha.cep ?? "",
    logradouro: ficha.logradouro ?? "",
    numero: ficha.numero ?? "",
    complemento: ficha.complemento ?? "",
    bairro: ficha.bairro ?? "",
    cidade: ficha.cidade ?? "",
    uf: ficha.uf ?? "",
  });

  function campo<K extends keyof typeof form>(chave: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
  }

  async function salvar() {
    // Só envia o que tem valor; vazios viram undefined para não sobrescrever com "".
    const trim = (v: string) => (v.trim() ? v.trim() : undefined);
    const payload: AtualizarFichaPayload = {
      nomeCompleto: form.nomeCompleto.trim(),
      rg: trim(form.rg),
      dataNascimento: form.dataNascimento || undefined,
      estadoCivil: (form.estadoCivil || undefined) as EstadoCivil | undefined,
      escolaridade: (form.escolaridade || undefined) as Escolaridade | undefined,
      whatsappOptIn: form.whatsappOptIn,
      telefone: trim(form.telefone),
      telefoneAlt: trim(form.telefoneAlt),
      email: trim(form.email),
      cep: trim(form.cep),
      logradouro: trim(form.logradouro),
      numero: trim(form.numero),
      complemento: trim(form.complemento),
      bairro: trim(form.bairro),
      cidade: trim(form.cidade),
      uf: trim(form.uf),
    };
    await mutation.mutateAsync({ id: ficha.id, dados: payload });
    onFechar();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo label="Nome completo" className="sm:col-span-2">
          <Input
            value={form.nomeCompleto}
            onChange={(e) => campo("nomeCompleto", e.target.value)}
          />
        </Campo>
        <Campo label="CPF (imutável)">
          <Input value={formatCpf(ficha.cpf)} disabled />
        </Campo>
        <Campo label="RG">
          <Input value={form.rg} onChange={(e) => campo("rg", e.target.value)} />
        </Campo>
        <Campo label="Nascimento">
          <Input
            type="date"
            value={form.dataNascimento}
            onChange={(e) => campo("dataNascimento", e.target.value)}
          />
        </Campo>
        <Campo label="Estado civil">
          <Select
            value={form.estadoCivil}
            onChange={(e) => campo("estadoCivil", e.target.value as EstadoCivil | "")}
          >
            <option value="">—</option>
            {estadoCivilOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Escolaridade">
          <Select
            value={form.escolaridade}
            onChange={(e) => campo("escolaridade", e.target.value as Escolaridade | "")}
          >
            <option value="">—</option>
            {escolaridadeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Telefone">
          <Input value={form.telefone} onChange={(e) => campo("telefone", e.target.value)} />
        </Campo>
        <Campo label="Telefone alt.">
          <Input value={form.telefoneAlt} onChange={(e) => campo("telefoneAlt", e.target.value)} />
        </Campo>
        <Campo label="E-mail">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => campo("email", e.target.value)}
          />
        </Campo>
        <Campo label="WhatsApp">
          <Select
            value={form.whatsappOptIn ? "1" : "0"}
            onChange={(e) => campo("whatsappOptIn", e.target.value === "1")}
          >
            <option value="1">Autorizado</option>
            <option value="0">Não autorizado</option>
          </Select>
        </Campo>
      </div>

      <h3 className="text-sm font-semibold text-foreground">Endereço</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo label="CEP">
          <Input value={form.cep} onChange={(e) => campo("cep", e.target.value)} />
        </Campo>
        <Campo label="Logradouro" className="sm:col-span-2">
          <Input value={form.logradouro} onChange={(e) => campo("logradouro", e.target.value)} />
        </Campo>
        <Campo label="Número">
          <Input value={form.numero} onChange={(e) => campo("numero", e.target.value)} />
        </Campo>
        <Campo label="Complemento">
          <Input value={form.complemento} onChange={(e) => campo("complemento", e.target.value)} />
        </Campo>
        <Campo label="Bairro">
          <Input value={form.bairro} onChange={(e) => campo("bairro", e.target.value)} />
        </Campo>
        <Campo label="Cidade">
          <Input value={form.cidade} onChange={(e) => campo("cidade", e.target.value)} />
        </Campo>
        <Campo label="UF">
          <Input
            value={form.uf}
            maxLength={2}
            onChange={(e) => campo("uf", e.target.value.toUpperCase())}
          />
        </Campo>
      </div>

      {mutation.isError ? (
        <Alerta>{(mutation.error as Error).message}</Alerta>
      ) : null}

      <div className="flex items-center gap-3">
        <Botao type="button" onClick={salvar} carregando={mutation.isPending}>
          <Check className="h-4 w-4" /> Salvar dados do titular
        </Botao>
        <Botao type="button" variante="outline" onClick={onFechar} disabled={mutation.isPending}>
          <X className="h-4 w-4" /> Cancelar
        </Botao>
      </div>
    </div>
  );
}

// ============================================================
// Edição inline da COMPOSIÇÃO FAMILIAR (membros)
// ============================================================
type MembroEdit = {
  nomeCompleto: string;
  cpf: string;
  dataNascimento: string;
  parentesco: Parentesco;
  ocupacao: string;
  escolaridade: Escolaridade | "";
  rendaMensal: string;
};

function membroParaEdit(m: Membro): MembroEdit {
  return {
    nomeCompleto: m.nomeCompleto,
    cpf: m.cpf ?? "",
    dataNascimento: m.dataNascimento.slice(0, 10),
    parentesco: m.parentesco,
    ocupacao: m.ocupacao ?? "",
    escolaridade: m.escolaridade ?? "",
    rendaMensal: m.rendaMensal ?? "",
  };
}

function membroVazio(): MembroEdit {
  return {
    nomeCompleto: "",
    cpf: "",
    dataNascimento: "",
    parentesco: "FILHO",
    ocupacao: "",
    escolaridade: "",
    rendaMensal: "",
  };
}

function FormularioMembros({
  ficha,
  onFechar,
}: {
  ficha: FichaDetalhe;
  onFechar: () => void;
}) {
  const mutation = useReplaceMembros();
  const [linhas, setLinhas] = useState<MembroEdit[]>(ficha.membros.map(membroParaEdit));

  function alterar<K extends keyof MembroEdit>(idx: number, chave: K, valor: MembroEdit[K]) {
    setLinhas((ls) => ls.map((l, i) => (i === idx ? { ...l, [chave]: valor } : l)));
  }
  function adicionar() {
    setLinhas((ls) => [...ls, membroVazio()]);
  }
  function remover(idx: number) {
    setLinhas((ls) => ls.filter((_, i) => i !== idx));
  }

  async function salvar() {
    // O PUT /membros faz reconciliação por chave natural (CPF ou nome+nascimento),
    // então o array completo é a verdade. Convertemos vazios em undefined.
    const membros: MembroPayload[] = linhas.map((l) => ({
      nomeCompleto: l.nomeCompleto.trim(),
      cpf: l.cpf.replace(/\D/g, "") || undefined,
      dataNascimento: l.dataNascimento,
      parentesco: l.parentesco,
      ocupacao: l.ocupacao.trim() || undefined,
      escolaridade: (l.escolaridade || undefined) as Escolaridade | undefined,
      rendaMensal: l.rendaMensal.trim() ? Number(l.rendaMensal) : undefined,
    }));
    await mutation.mutateAsync({ id: ficha.id, membros });
    onFechar();
  }

  return (
    <div className="space-y-4">
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum membro. Adicione abaixo.</p>
      ) : null}

      <ul className="space-y-4">
        {linhas.map((l, idx) => (
          <li key={idx} className="rounded-md border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Membro {idx + 1}</span>
              <Botao
                type="button"
                variante="ghost"
                onClick={() => remover(idx)}
                className="px-2 py-1 text-sm text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remover
              </Botao>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo label="Nome completo" className="sm:col-span-2">
                <Input
                  value={l.nomeCompleto}
                  onChange={(e) => alterar(idx, "nomeCompleto", e.target.value)}
                />
              </Campo>
              <Campo label="Parentesco">
                <Select
                  value={l.parentesco}
                  onChange={(e) => alterar(idx, "parentesco", e.target.value as Parentesco)}
                >
                  {parentescoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Campo>
              <Campo label="CPF (opcional)">
                <Input value={l.cpf} onChange={(e) => alterar(idx, "cpf", e.target.value)} />
              </Campo>
              <Campo label="Nascimento">
                <Input
                  type="date"
                  value={l.dataNascimento}
                  onChange={(e) => alterar(idx, "dataNascimento", e.target.value)}
                />
              </Campo>
              <Campo label="Ocupação">
                <Input
                  value={l.ocupacao}
                  onChange={(e) => alterar(idx, "ocupacao", e.target.value)}
                />
              </Campo>
              <Campo label="Escolaridade">
                <Select
                  value={l.escolaridade}
                  onChange={(e) => alterar(idx, "escolaridade", e.target.value as Escolaridade | "")}
                >
                  <option value="">—</option>
                  {escolaridadeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Renda mensal (R$)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={l.rendaMensal}
                  onChange={(e) => alterar(idx, "rendaMensal", e.target.value)}
                />
              </Campo>
            </div>
          </li>
        ))}
      </ul>

      <Botao type="button" variante="outline" onClick={adicionar}>
        <Plus className="h-4 w-4" /> Adicionar membro
      </Botao>

      {mutation.isError ? (
        <Alerta>{(mutation.error as Error).message}</Alerta>
      ) : null}

      <div className="flex items-center gap-3">
        <Botao type="button" onClick={salvar} carregando={mutation.isPending}>
          <Check className="h-4 w-4" /> Salvar composição familiar
        </Botao>
        <Botao type="button" variante="outline" onClick={onFechar} disabled={mutation.isPending}>
          <X className="h-4 w-4" /> Cancelar
        </Botao>
      </div>
    </div>
  );
}

// Card de elegibilidade por unidade (estado local de edição + salvar).
function CardElegibilidade({
  fichaId,
  slug,
  nome,
  atual,
}: {
  fichaId: string;
  slug: string;
  nome: string;
  atual?: Elegibilidade;
}) {
  const mutation = useUpdateElegibilidade();
  const [status, setStatus] = useState<StatusElegibilidade>(atual?.status ?? "PENDENTE");
  const [motivo, setMotivo] = useState(atual?.motivo ?? "");
  const [reavaliarEm, setReavaliarEm] = useState(atual?.reavaliarEm?.slice(0, 10) ?? "");
  const [salvo, setSalvo] = useState(false);

  async function salvar() {
    setSalvo(false);
    await mutation.mutateAsync({
      id: fichaId,
      unidadeSlug: slug,
      dados: {
        status,
        ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
        ...(reavaliarEm ? { reavaliarEm } : {}),
      },
    });
    setSalvo(true);
  }

  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{nome}</span>
        {atual ? <BadgeStatus status={atual.status} /> : (
          <span className="text-xs text-muted-foreground">não avaliada</span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusElegibilidade)}>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Reavaliar em">
          <Input type="date" value={reavaliarEm} onChange={(e) => setReavaliarEm(e.target.value)} />
        </Campo>
      </div>
      <Campo label="Motivo / observação" className="mt-3">
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
      </Campo>
      <div className="mt-3 flex items-center gap-3">
        <Botao type="button" onClick={salvar} carregando={mutation.isPending}>
          Salvar elegibilidade
        </Botao>
        {salvo && !mutation.isPending ? (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <Check className="h-3.5 w-3.5" /> salvo
          </span>
        ) : null}
        {mutation.isError ? (
          <span className="text-xs text-danger">{(mutation.error as Error).message}</span>
        ) : null}
      </div>
      {atual?.avaliadoEm ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Última avaliação: {formatDataHora(atual.avaliadoEm)}
        </p>
      ) : null}
    </div>
  );
}

// ============================================================
// Documentos da ficha (upload + lista + download/baixar) — Onda C2
// ============================================================
const TIPO_DOC_OPTIONS = Object.entries(TIPO_DOCUMENTO_LABEL) as [TipoDocumento, string][];

/** Tamanho legível (KB/MB) — só para exibição na lista. */
function formatTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function LinhaDocumento({ doc, fichaId }: { doc: DocumentoFicha; fichaId: string }) {
  const baixar = useBaixarDocumento(fichaId);
  const remover = useRemoverDocumento(fichaId);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{doc.nomeArquivo}</p>
          <p className="text-xs text-muted-foreground">
            {TIPO_DOCUMENTO_LABEL[doc.tipo]} · {formatTamanho(doc.tamanhoBytes)} ·{" "}
            {formatDataHora(doc.enviadoEm)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Botao
          type="button"
          variante="outline"
          onClick={() => baixar.mutate(doc.id)}
          carregando={baixar.isPending}
          className="px-3 py-1.5 text-sm"
        >
          <Download className="h-3.5 w-3.5" /> Baixar
        </Botao>
        <Botao
          type="button"
          variante="ghost"
          onClick={() => {
            if (confirm(`Remover o documento "${doc.nomeArquivo}"?`)) remover.mutate(doc.id);
          }}
          carregando={remover.isPending}
          className="px-2 py-1.5 text-sm text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </Botao>
      </div>
    </li>
  );
}

function SecaoDocumentos({ fichaId }: { fichaId: string }) {
  const { data: docs, isLoading } = useDocumentos(fichaId);
  const upload = useUploadDocumento(fichaId);
  const [tipo, setTipo] = useState<TipoDocumento>("RG");
  const inputRef = useRef<HTMLInputElement>(null);

  async function enviar(arquivo: File) {
    await upload.mutateAsync({ tipo, arquivo });
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Secao titulo="Documentos">
      <p className="mb-4 text-sm text-muted-foreground">
        Anexe documentos da família (PDF, JPG ou PNG, até 8 MB). Cada acesso e exclusão fica
        registrado na trilha de auditoria.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-border p-4">
        <Campo label="Tipo do documento">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)}>
            {TIPO_DOC_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Campo>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void enviar(f);
            }}
          />
          <Botao
            type="button"
            onClick={() => inputRef.current?.click()}
            carregando={upload.isPending}
          >
            <Upload className="h-4 w-4" /> Enviar arquivo
          </Botao>
        </div>
      </div>

      {upload.isError ? <Alerta>{(upload.error as Error).message}</Alerta> : null}

      {isLoading ? (
        <Spinner label="Carregando documentos..." />
      ) : !docs || docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>
      ) : (
        <ul className="divide-y divide-border">
          {docs.map((doc) => (
            <LinhaDocumento key={doc.id} doc={doc} fichaId={fichaId} />
          ))}
        </ul>
      )}
    </Secao>
  );
}

// ============================================================
// Acesso da família (auto-provisionamento — reusa o 1º acesso)
// ============================================================
function SecaoAcessoFamilia({ fichaId }: { fichaId: string }) {
  const { data, isLoading } = useAcessoFamilia(fichaId);
  const mutation = useGerarAcessoFamilia();
  // A senha provisória só existe no momento da geração: guardamos em estado
  // local para exibi-la UMA vez (some ao recarregar/navegar — nunca persiste).
  const [senha, setSenha] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const possui = data?.possuiAcesso ?? false;
  const acesso = data?.acesso ?? null;

  async function gerar() {
    setSenha(null);
    setCopiado(false);
    const r = await mutation.mutateAsync(fichaId);
    if (r.senhaProvisoria) setSenha(r.senhaProvisoria);
  }

  async function copiar() {
    if (!senha) return;
    try {
      await navigator.clipboard.writeText(senha);
      setCopiado(true);
    } catch {
      /* clipboard pode falhar sem HTTPS — a senha segue visível na tela */
    }
  }

  return (
    <Secao titulo="Acesso da família">
      <p className="mb-4 text-sm text-muted-foreground">
        Gera o login do responsável (perfil <strong>Responsável familiar</strong>) com uma{" "}
        <strong>senha provisória</strong>. Anote e entregue ao responsável: no primeiro acesso
        ele troca a senha. O sistema <strong>não envia e-mail</strong> — a senha aparece aqui uma
        única vez.
      </p>

      {isLoading ? (
        <Spinner label="Verificando acesso..." />
      ) : possui && acesso ? (
        <div className="rounded-md border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-success">
              <Check className="h-4 w-4" /> Acesso já criado
            </span>
            {acesso.mustChangePassword ? (
              <span className="text-xs text-muted-foreground">aguardando 1º acesso</span>
            ) : (
              <span className="text-xs text-success">senha já trocada pela família</span>
            )}
          </div>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            <Item label="Login (e-mail)">{acesso.email}</Item>
            <Item label="Último acesso">
              {acesso.ultimoLogin ? formatDataHora(acesso.ultimoLogin) : "nunca acessou"}
            </Item>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Esqueceu a senha? Reemita pela gestão de usuários (Admin → Usuários → Resetar senha).
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <Botao type="button" onClick={gerar} carregando={mutation.isPending}>
            <KeyRound className="h-4 w-4" /> Gerar acesso da família
          </Botao>
          {mutation.isError ? <Alerta>{(mutation.error as Error).message}</Alerta> : null}
        </div>
      )}

      {/* Senha provisória recém-gerada — exibida uma única vez */}
      {senha ? (
        <div className="mt-4 rounded-md border border-success/40 bg-success/5 p-4">
          <p className="text-sm font-semibold text-foreground">
            Acesso criado. Anote a senha provisória (não será mostrada de novo):
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="rounded bg-surface px-3 py-1.5 font-mono text-base tracking-wider text-foreground">
              {senha}
            </code>
            <Botao type="button" variante="outline" onClick={copiar} className="px-3 py-1.5 text-sm">
              {copiado ? "Copiado!" : "Copiar"}
            </Botao>
          </div>
        </div>
      ) : null}
    </Secao>
  );
}

// ============================================================
// Histórico de encaminhamentos (timeline) — read-only, padrão CASA
// ============================================================
const PRIORIDADE_PILULA: Record<PrioridadeSinal, string> = {
  NORMAL: "border-border text-muted-foreground",
  URGENTE: "border-danger/40 bg-danger/10 text-danger",
};
const STATUS_PILULA: Record<StatusEncaminhamento, string> = {
  PENDENTE: "border-border text-muted-foreground",
  ACEITO: "border-success/40 bg-success/10 text-success",
  RECUSADO: "border-danger/40 bg-danger/10 text-danger",
};

function Pilula({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

function SecaoHistoricoEncaminhamentos({ fichaId }: { fichaId: string }) {
  const { data, isLoading, isError, error } = useHistoricoEncaminhamentos(fichaId);
  const items = data?.items ?? [];

  return (
    <Secao titulo="Histórico de encaminhamentos">
      <p className="mb-4 text-sm text-muted-foreground">
        Encaminhamentos desta família entre as unidades, dos mais recentes aos mais antigos.
      </p>

      {isLoading ? (
        <Spinner label="Carregando histórico..." />
      ) : isError ? (
        <Alerta>{(error as Error)?.message ?? "Não foi possível carregar o histórico."}</Alerta>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum encaminhamento registrado.</p>
      ) : (
        <ol className="relative space-y-5 border-l border-border pl-5">
          {items.map((enc) => (
            <li key={enc.id} className="relative">
              <span
                className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-primary"
                aria-hidden
              />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                  <span>{enc.unidadeOrigem.nome}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span>{enc.unidadeDestino.nome}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Pilula className={PRIORIDADE_PILULA[enc.prioridade]}>
                    {PRIORIDADE_SINAL_LABEL[enc.prioridade]}
                  </Pilula>
                  <Pilula className={STATUS_PILULA[enc.status]}>
                    {STATUS_ENCAMINHAMENTO_LABEL[enc.status]}
                  </Pilula>
                </div>
              </div>
              <p className="mt-1 text-sm text-foreground">{enc.motivo}</p>
              {enc.justificativaResposta ? (
                <p className="mt-1 text-xs text-danger">Recusado: {enc.justificativaResposta}</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                Aberto em {formatDataHora(enc.criadoEm)}
                {enc.respondidoEm ? ` · respondido em ${formatDataHora(enc.respondidoEm)}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Secao>
  );
}

export default function FichaDetalhePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: ficha, isLoading, isError, error } = useFicha(id);
  // Painéis inline de edição (um por vez, estilo CASA).
  const [editandoTitular, setEditandoTitular] = useState(false);
  const [editandoMembros, setEditandoMembros] = useState(false);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Spinner label="Carregando ficha..." />
      </main>
    );
  }

  if (isError || !ficha) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link
          href="/servico-social/fichas"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <Alerta>{(error as Error)?.message ?? "Ficha não encontrada."}</Alerta>
      </main>
    );
  }

  const idade = idadeAnos(ficha.dataNascimento);
  const endereco = [
    ficha.logradouro,
    ficha.numero,
    ficha.complemento,
    ficha.bairro,
    [ficha.cidade, ficha.uf].filter(Boolean).join("/"),
    ficha.cep ? `CEP ${ficha.cep}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const beneficios = [
    ficha.dadosSocio?.recebeBolsaFamilia && "Bolsa Família",
    ficha.dadosSocio?.recebeBPC && "BPC",
    ficha.dadosSocio?.recebeAuxilioGas && "Auxílio Gás",
    ficha.dadosSocio?.outrosBeneficios,
  ].filter(Boolean) as string[];

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-6 py-10">
      <Link
        href="/servico-social/fichas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para a listagem
      </Link>

      {/* Cabeçalho */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {ficha.nomeCompleto}
            {!ficha.ativa ? (
              <span className="ml-2 align-middle text-sm font-normal text-danger">(inativa)</span>
            ) : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ficha.protocolo} · cadastrada em {formatDataHora(ficha.criadoEm)}
          </p>
        </div>
      </header>

      {/* Titular + contato + endereço (somente leitura ou edição inline) */}
      {editandoTitular ? (
        <Secao titulo="Editar dados do titular">
          <FormularioTitular ficha={ficha} onFechar={() => setEditandoTitular(false)} />
        </Secao>
      ) : (
        <>
          <Secao
            titulo="Dados do titular"
            acao={<BotaoEditar onClick={() => setEditandoTitular(true)} />}
          >
            <dl className="grid gap-4 sm:grid-cols-3">
              <Item label="CPF">{formatCpf(ficha.cpf)}</Item>
              <Item label="RG">{ficha.rg}</Item>
              <Item label="Nascimento">
                {formatDataISO(ficha.dataNascimento)}
                {idade !== null ? ` (${idade} anos)` : ""}
              </Item>
              <Item label="Estado civil">
                {ficha.estadoCivil ? ESTADO_CIVIL_LABEL[ficha.estadoCivil] : null}
              </Item>
              <Item label="Escolaridade">
                {ficha.escolaridade ? ESCOLARIDADE_LABEL[ficha.escolaridade] : null}
              </Item>
              <Item label="WhatsApp">{ficha.whatsappOptIn ? "Autorizado" : "Não"}</Item>
            </dl>
          </Secao>

          <Secao titulo="Contato e endereço">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Item label="Telefone">{formatTelefone(ficha.telefone)}</Item>
              <Item label="Telefone alt.">{formatTelefone(ficha.telefoneAlt)}</Item>
              <Item label="E-mail">{ficha.email}</Item>
              <div className="sm:col-span-3">
                <Item label="Endereço">{endereco}</Item>
              </div>
            </dl>
          </Secao>
        </>
      )}

      {/* Composição familiar */}
      {editandoMembros ? (
        <Secao titulo="Editar composição familiar">
          <FormularioMembros ficha={ficha} onFechar={() => setEditandoMembros(false)} />
        </Secao>
      ) : (
        <Secao
          titulo={`Composição familiar (${ficha.membros.length})`}
          acao={<BotaoEditar onClick={() => setEditandoMembros(true)} />}
        >
          {ficha.membros.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum membro cadastrado.</p>
          ) : (
            <ul className="divide-y divide-border">
              {ficha.membros.map((m) => {
                const idadeM = idadeAnos(m.dataNascimento);
                return (
                  <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                    <span className="font-medium text-foreground">{m.nomeCompleto}</span>
                    <span className="text-muted-foreground">
                      {PARENTESCO_LABEL[m.parentesco]}
                      {idadeM !== null ? ` · ${idadeM} anos` : ""}
                      {m.ocupacao ? ` · ${m.ocupacao}` : ""}
                      {m.rendaMensal ? ` · ${formatMoeda(m.rendaMensal)}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Secao>
      )}

      {/* Socioeconômico */}
      <Secao titulo="Dados socioeconômicos">
        {!ficha.dadosSocio ? (
          <p className="text-sm text-muted-foreground">Não preenchidos.</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-3">
            <Item label="Renda familiar total">{formatMoeda(ficha.dadosSocio.rendaFamiliarTotal)}</Item>
            <Item label="Renda per capita">{formatMoeda(ficha.dadosSocio.rendaPerCapita)}</Item>
            <Item label="Situação de moradia">
              {SITUACAO_MORADIA_LABEL[ficha.dadosSocio.situacaoMoradia]}
            </Item>
            <Item label="Pessoas na moradia">{ficha.dadosSocio.numeroPessoasMoradia}</Item>
            <Item label="Cômodos">{ficha.dadosSocio.numeroComodos}</Item>
            <Item label="Benefícios">{beneficios.length ? beneficios.join(", ") : "Nenhum"}</Item>
            <Item label="Infraestrutura">
              {[
                ficha.dadosSocio.temAguaEncanada && "Água",
                ficha.dadosSocio.temEsgoto && "Esgoto",
                ficha.dadosSocio.temEnergiaEletrica && "Energia",
              ]
                .filter(Boolean)
                .join(", ") || "—"}
            </Item>
            <div className="sm:col-span-3">
              <Item label="Vulnerabilidades">{ficha.dadosSocio.vulnerabilidades}</Item>
            </div>
          </dl>
        )}
      </Secao>

      {/* Elegibilidade por unidade */}
      <Secao titulo="Elegibilidade por unidade">
        <p className="mb-4 text-sm text-muted-foreground">
          Defina o status de cada unidade. Gestores só enxergam beneficiários{" "}
          <strong>aprovados</strong> para a sua unidade.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {UNIDADES.map((u) => (
            <CardElegibilidade
              key={u.slug}
              fichaId={ficha.id}
              slug={u.slug}
              nome={u.nome}
              atual={ficha.elegibilidades.find((e) => e.unidade.slug === u.slug)}
            />
          ))}
        </div>
      </Secao>

      {/* Histórico de encaminhamentos entre unidades (timeline read-only) */}
      <SecaoHistoricoEncaminhamentos fichaId={ficha.id} />

      {/* Documentos da ficha (upload + lista + baixar) */}
      <SecaoDocumentos fichaId={ficha.id} />

      {/* Acesso da família (auto-provisionamento) */}
      <SecaoAcessoFamilia fichaId={ficha.id} />

      {ficha.observacoes ? (
        <Secao titulo="Observações">
          <p className="whitespace-pre-wrap text-sm text-foreground">{ficha.observacoes}</p>
        </Secao>
      ) : null}
    </main>
  );
}
