# Checklist de segurança/correção — critérios de aceitação da reconciliação

> Saída do review adversarial (2026-06-10): 4 lentes × caçar→refutar. 23 achados
> confirmados, 3 refutados pelos céticos. **Contexto:** sob a Estratégia A (main vira a
> base — ver `DOSSIE-RECONCILIACAO-MAIN-X-CASA.md`), o backend da branch CASA é
> referência, não produção. Estes itens viram **critérios que o código na `main` deve
> satisfazer** após o merge. Vários podem JÁ estar tratados na main (ela tem IDOR guard
> e locks transacionais, segundo o dossiê) — usar como checklist de verificação.

## 🔴 ALTA
- [ ] **Tenant/RBAC — busca de fichas no Médico sem recorte de unidade** (`medico/agenda.service.ts:93`): `buscarFichas` enumera PII (nome, nascimento, dependentes) de QUALQUER cidadão; CPF vira oráculo via LIKE. Causa-raiz no item abaixo.
- [ ] **Endpoints do Médico não validam a unidade do profissional** (`medico/profissionais.service.ts:16`): `resolverPorUser` só checa cadastro ativo, não o `TipoUnidade`. Um instrutor da Capacitação (mesmo modelo `Profissional`, perfil `PROFISSIONAL`) passa pelos guards de `/medico/*`. → exigir `UnidadeGuard`/checagem de `TipoUnidade` por módulo. *(na main, validar via `UserRole.unit_scope`)*
- [ ] **Minimização — agenda retorna CPF do titular e registro completo do dependente** (CPF, rendaMensal, observações) sem necessidade e sem audit READ (`medico/agenda.service.ts:10-22,58-67`).
- [ ] **Race condition na matrícula — overbooking de vagas + posição de espera duplicada** (`capacitacao/turmas.service.ts:178-232`): contagem fora de transação/lock. *(o dossiê diz que a main usa lock transacional — confirmar.)*
- [ ] **Janela da agenda depende do timezone do servidor** (`medico/agenda.service.ts:46-52`): em Docker (UTC) o "dia" corta às 21h de Brasília. → fixar timezone (America/Sao_Paulo) no cálculo.

## 🟠 MÉDIA
- [ ] Prancha retorna todos os escalares da ficha (RG, telefones, e-mail, endereço, observações) sem `select` de minimização (`medico/agenda.service.ts:25-35,70-90`).
- [ ] `criarAgendamento` sem checar elegibilidade/tenant da ficha; grava `unidadeId` da unidade errada (`medico/agenda.service.ts:128`).
- [ ] `/medico/fichas` lê dado pessoal sem audit READ (`medico/agenda.service.ts:93-125`).
- [ ] Audit do EXPORT do PDF não captura ip/userAgent — trilha anônima (`capacitacao/certificado-pdf.service.ts:165-170`).
- [ ] Verificação pública lê nome do beneficiário sem audit (inconsistente com o PDF) (`capacitacao/verificacao.controller.ts:31-63`).
- [ ] Unique de matrícula não cobre `membroId NULL` — titular matriculável 2x sob concorrência (`schema.prisma:653`).
- [ ] Iniciar atendimento 2x simultâneo → 500 (P2002 não tratado) em vez de idempotente (`medico/agenda.service.ts:182-221`).
- [ ] Chamada gravável após o selo da aula (race lancarChamada × encerrar) (`capacitacao/aulas.service.ts:82-102`).
- [ ] Prontuário editável após o selo sob concorrência (salvarSoap/upsertVitais × encerrar) (`medico/atendimentos.service.ts:46-111`).
- [ ] Turma encerrada com aula aberta: chamada/selo ainda permitidos, alteram presença% (`capacitacao/aulas.service.ts:78-139`).
- [ ] Encerramento da turma decide certificados sobre snapshot fora da transação, sem guard de status (`capacitacao/turmas.service.ts:272-326`).
- [ ] Certificado atesta carga horária total com uma única aula encerrada (`capacitacao/turmas.service.ts:283-304`).

## ⚪ BAIXA
- [ ] Content-Disposition com filename derivado de nome não sanitizado (`capacitacao/verificacao.controller.ts:27`).
- [ ] Audit READ da prancha com `entidadeId` null quando o atendimento ainda não existe (`medico/agenda.service.ts:81-87`).
- [ ] Caminho idempotente de `iniciar` retorna vitais sem audit READ (`medico/agenda.service.ts:192`).
- [ ] Detalhe de turma/aula expõe dados de alunos sem audit READ (`capacitacao/turmas.service.ts:245-267`).
- [ ] Lista de espera nunca resolvida no encerramento — KPI `listaEspera` inflado (`capacitacao/turmas.service.ts:294`).
- [ ] Cálculo de idade por 365.25 dias erra no aniversário/timezone (`web/medico/agenda/page.tsx:29-31`).

## Padrões a garantir no código reconciliado
1. **Todo endpoint de unidade valida o `TipoUnidade`** do profissional (não só o perfil).
2. **Toda leitura de dado sensível registra audit READ**; `select` mínimo nas respostas.
3. **Operações com vaga/selo usam transação + lock** (sem snapshot fora da tx).
4. **Datas de negócio com timezone explícito** (America/Sao_Paulo), nunca o TZ do processo.
