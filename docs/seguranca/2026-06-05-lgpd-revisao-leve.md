# Revisão LGPD leve — IFP Connect (fundação de produção)

**Data:** 2026-06-05 · **Contexto:** o sistema trata **dados pessoais sensíveis** (saúde — consultas/prontuário; e dados de assistência social — cidadãos/triagem). LGPD Art. 11 (dado sensível) exige base legal específica + medidas de segurança reforçadas. Esta é uma revisão **técnica leve** (o que dá pra avaliar do código), não um parecer jurídico.

## ✅ Pontos fortes (verificados no código)

- **Superfície pública mínima** (`src/proxy.ts`): só `/` (site), `/reset` e `/<unidade>/login` são públicos. **Todo o resto exige sessão** — cidadãos, prontuário, consultas, triagem, vagas estão 100% atrás de auth.
- **Controle de acesso por unidade** (`canAccessUnidade`): cada usuário só acessa a(s) unidade(s) do seu papel; `social`/`poncio` são transversais **por papel** (`unitScope: null`), não por exposição.
- **Admin gated**: `/admin/*` só `super_admin`/`presidencia`; `/admin/audit` só `super_admin`.
- **API de anexos** (`/api/cidadao-anexo/[id]`): exige sessão + RBAC com unit-scope (`can(... "view","ficha_cidada" ...)`) + entrega via **URL presigned** (tempo limitado, sem acesso direto ao storage) + respeita **soft-delete** (`deletedAt`).
- **Em trânsito:** HTTPS (TLS do Tailscale Funnel).
- **Trilha de auditoria** existe (`lib/audit` — atos clínicos não têm bypass de admin).
- **Soft-delete** (`deletedAt`) — não apaga fisicamente, preserva trilha.
- **Segredos fora do git** (`.env.prod`, perms 600).
- **Backup** agora existe (F0 — `ops/vm/backup.sh` + cron diário).

## ⚠️ Riscos / recomendações (antes de dado REAL)

| # | Item | Recomendação |
|---|------|--------------|
| 1 | **Backups têm dados sensíveis** | Os dumps (VM + cópia no host) precisam de acesso restrito **e idealmente criptografia**. Hoje o dump é texto comprimido sem cripto. → cifrar o dump (`age`/`gpg`) ou garantir pasta restrita+cifrada no host. |
| 2 | **Dado em repouso não cifrado** | O volume do Postgres não é cifrado em disco. Pra prod, considerar disco/volume cifrado na VM. |
| 3 | **Sudo `NOPASSWD:ALL`** | Comprometer `erickramos` = root. Escopar o sudo (ver REPORT — preparado, você aplica). |
| 4 | **Firewall desligado** | Habilitar `ufw` (ver REPORT — preparado). |
| 5 | **Rotas `/api/*` não passam pelo proxy** | Cada rota de API precisa fazer auth própria. Conferi a de anexos (OK); **auditar todas as rotas `/api` antes de prod**. |
| 6 | **Base legal + consentimento** | Ao migrar pra dado real, o instituto precisa definir/documentar a **base legal** (Art. 11 — tutela da saúde / assistência ou consentimento) e o fluxo de consentimento das famílias. *(processo, não código)* |
| 7 | **Retenção / minimização** | Definir política de retenção (por quanto tempo guardar dados de cidadão inativo). *(decisão do instituto)* |
| 8 | **Encarregado (DPO) + Política de Privacidade** | Exigências LGPD pra operação real. *(processo)* |
| 9 | **STAGING tem dados DEMO** | Não usar com dado real de paciente/família até hardening (1-5) + base legal (6) resolvidos. Banner STAGING já avisa no app interno. |

## Veredito

A **arquitetura técnica está num bom ponto de partida** pra LGPD: acesso controlado, superfície mínima, auditoria, soft-delete, trânsito cifrado. Os gaps são **operacionais** (cripto de backup, firewall, sudo, repouso) e **de processo** (base legal, consentimento, retenção, DPO) — nenhum bloqueia o staging demo, todos precisam ser fechados **antes de dado real**.
