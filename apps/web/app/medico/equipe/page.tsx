"use client";

/**
 * Equipe do Centro Médico — cadastra os profissionais. Um usuário criado em
 * Administração › Usuários (perfil Profissional, unidade médica) ainda precisa
 * de um cadastro de profissional aqui para conseguir abrir a agenda.
 */
import { useState } from "react";
import { Plus, Stethoscope, UserPlus, X } from "lucide-react";

import {
  useCandidatosEquipe,
  useEditarProfissional,
  useEquipe,
  useVincularProfissional,
  type CandidatoEquipe,
} from "@/lib/use-medico";
import { Alerta, Botao, Campo, Input, Select, Spinner } from "@/components/ui";
import { Card, PageHeader, Pill } from "@/components/casa";

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

function FormVincular({
  candidatos,
  onFechar,
}: {
  candidatos: CandidatoEquipe[];
  onFechar: () => void;
}) {
  const vincular = useVincularProfissional();
  const [userId, setUserId] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [conselho, setConselho] = useState("");
  const [uf, setUf] = useState("RJ");
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!userId) {
      setErro("Escolha um usuário.");
      return;
    }
    try {
      await vincular.mutateAsync({
        userId,
        especialidade: especialidade.trim() || undefined,
        registroConselho: conselho.trim() || undefined,
        ufConselho: uf.trim() || undefined,
      });
      onFechar();
    } catch (err) {
      setErro((err as Error).message || "Falha ao vincular.");
    }
  }

  if (candidatos.length === 0) {
    return (
      <Card className="mb-6">
        <Alerta tipo="info">
          Nenhum usuário disponível para vincular. Crie primeiro um usuário com o perfil
          <strong> Profissional</strong> e a unidade <strong>Centro Médico</strong> em
          Administração › Usuários.
        </Alerta>
        <div className="mt-3 flex justify-end">
          <Botao variante="ghost" onClick={onFechar}>Fechar</Botao>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Usuário" htmlFor="userId" obrigatorio className="sm:col-span-2">
            <Select id="userId" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Selecione...</option>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} — {c.email}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Especialidade" htmlFor="esp">
            <Input id="esp" value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} placeholder="Clínica Geral" />
          </Campo>
          <Campo label="Registro do conselho (CRM/COREN)" htmlFor="crm">
            <Input id="crm" value={conselho} onChange={(e) => setConselho(e.target.value)} placeholder="52-99999-9" />
          </Campo>
          <Campo label="UF do conselho" htmlFor="uf">
            <Input id="uf" value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} className="w-20 uppercase" />
          </Campo>
        </div>
        {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="ghost" onClick={onFechar} disabled={vincular.isPending}>Cancelar</Botao>
          <Botao type="submit" carregando={vincular.isPending}>
            <UserPlus className="h-4 w-4" /> Vincular à equipe
          </Botao>
        </div>
      </form>
    </Card>
  );
}

export default function EquipePage() {
  const { data, isLoading, error } = useEquipe();
  const { data: candidatos } = useCandidatosEquipe();
  const editar = useEditarProfissional();
  const [vinculando, setVinculando] = useState(false);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader
        titulo="Equipe"
        descricao="Profissionais do Centro Médico."
        acoes={
          !vinculando ? (
            <Botao onClick={() => setVinculando(true)}>
              <Plus className="h-4 w-4" /> Adicionar
            </Botao>
          ) : null
        }
      />

      {vinculando ? (
        <FormVincular candidatos={candidatos?.items ?? []} onFechar={() => setVinculando(false)} />
      ) : null}

      {isLoading ? <Spinner label="Carregando equipe..." /> : null}
      {error ? <Alerta>{(error as Error).message}</Alerta> : null}

      {data ? (
        <div className="space-y-3">
          {data.items.map((p) => (
            <Card key={p.id} className={p.ativo ? "" : "opacity-70"}>
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--unidade-suave)] font-semibold text-[var(--unidade-escuro)]">
                  {iniciais(p.user.nome)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground">{p.user.nome}</div>
                  <div className="text-sm text-muted-foreground">{p.user.email}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.especialidade ? <Pill tom="unidade">{p.especialidade}</Pill> : null}
                    {p.registroConselho ? <Pill>{p.registroConselho}/{p.ufConselho}</Pill> : null}
                    {!p.ativo ? <Pill tom="warn">Inativo</Pill> : null}
                  </div>
                </div>
                <Botao
                  variante={p.ativo ? "danger" : "primary"}
                  carregando={editar.isPending}
                  onClick={() => editar.mutate({ id: p.id, dados: { ativo: !p.ativo } })}
                >
                  {p.ativo ? "Inativar" : "Ativar"}
                </Botao>
              </div>
            </Card>
          ))}
          {data.items.length === 0 ? (
            <Card className="text-center text-sm text-muted-foreground">
              <Stethoscope className="mx-auto mb-2 h-5 w-5" />
              Nenhum profissional cadastrado — use “Adicionar”.
            </Card>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
