# Decisões de Produção — IFP Connect

> Registro de decisões conscientes de produto/arquitetura que a auditoria
> (`docs/AUDITORIA-2026-06-25.md`) levantou como pontos a resolver. Cada item aqui
> é uma escolha deliberada (com trade-off aceito), **não** um esquecimento.
> Atualize este arquivo quando uma decisão for revista.

---

## 1. Recuperação de senha é admin-driven (sem e-mail/WhatsApp) — ref. P1.7

**Decisão:** o reset de senha do IFP Connect é **administrado por um admin**, não
self-service. Não há envio de e-mail, WhatsApp ou push para recuperação de senha.

**Como funciona hoje:**

- Um administrador gera uma **senha provisória** para o usuário pela gestão de usuários.
- O usuário entra com a senha provisória e é obrigado a trocá-la no primeiro acesso
  (`POST /auth/trocar-senha`, flag `mustChangePassword` no banco).
- A flag `mustChangePassword` é lida do banco a cada request (não do token), então um
  reset feito pelo admin passa a valer já na request seguinte
  (`apps/api/src/auth/jwt.strategy.ts`).

**Por que (trade-off aceito):**

- O público é interno/institucional e o time de admin é pequeno e próximo dos usuários;
  o reset presencial/assistido é viável e evita um canal de envio para manter.
- Evita dependência de um provedor de e-mail/SMS (custo, deliverability, mais uma
  superfície de ataque por link de redefinição) antes do lançamento.

**Consequência de código:** a variável `RESEND_API_KEY` era **código-morto** — não havia
nenhuma leitura dela na API (zero envio de e-mail/SMTP/forgot-password). Foi **removida**
de `.env.example` e do `.env` de desenvolvimento para não induzir a erro quem montar o
ambiente. (Refs em `projetoifp.md` e `prototipos/` são de planejamento antigo e ficam
como histórico.)

**Roadmap (se um dia for revisto):** implementar reset por e-mail via Resend
(magic link / link de redefinição com token de uso único e expiração curta), ou um
gateway de WhatsApp. Ao reintroduzir, recolocar a variável **e** a leitura no código
no mesmo PR — nunca deixar a variável sozinha como código-morto de novo.

---

## 2. Sessão JWT stateless de 8h, sem blacklist de logout — ref. §2.4.1 da auditoria

**Decisão:** a sessão é um **JWT stateless** com expiração de 8h (`JWT_EXPIRES_IN="8h"`).
Não há blacklist/revogação de token no logout por ora. O logout é feito no cliente
(descarte do token).

**Trade-off aceito:** um token comprometido permanece válido **até 8h** após o
comprometimento (não dá para revogar um JWT específico em tempo real sem estado servidor).

**Mitigações já presentes (reduzem a janela na prática):**

- A `JwtStrategy.validate` **revalida o usuário no banco a cada request**: se o usuário
  for **desativado** (`user.ativo === false`), qualquer token dele é rejeitado na hora
  (`apps/api/src/auth/jwt.strategy.ts`) — ou seja, dá para "cortar" um usuário
  imediatamente desativando-o, sem esperar o token expirar.
- A troca de senha obrigatória (`mustChangePassword`) também é lida do banco a cada
  request, então um reset de senha tem efeito imediato.
- Rate-limit apertado no login (10/min por IP) contra credential-stuffing
  (`apps/api/src/auth/auth.controller.ts`).

**Por que não blacklist agora:** manter o auth **stateless** simplifica a operação
(sem dependência de Redis no caminho crítico de autenticação) e a janela de 8h é
considerada aceitável para o perfil de risco interno do sistema no lançamento.

**Roadmap:** logout real com **blacklist de JWT em Redis** (já há Redis na stack para
throttle), invalidando o `jti`/token no logout e em "encerrar todas as sessões".
Alternativa: encurtar o TTL do access token e adotar refresh tokens revogáveis.

> Importante: esta decisão **não altera o comportamento atual do auth** — está
> documentada apenas para registrar que o trade-off é consciente.
