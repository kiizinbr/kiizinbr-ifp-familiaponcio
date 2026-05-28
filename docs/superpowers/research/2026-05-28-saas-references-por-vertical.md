# Pesquisa de SaaS de referência por vertical — IFP Connect

**Data:** 2026-05-28
**Gatilho:** primeira apresentação à diretoria. Feedback: "parece software de 5 anos atrás, UI/UX muito simples". Diretoria pediu pra Erick procurar SaaS de referência _como se fosse contratar um por unidade_. Amplimed (médico) foi mencionado mas explicitamente NÃO é referência.
**Método:** 4 agentes paralelos com WebSearch + WebFetch, um por vertical (médico, capacitação, recreativo, esportivo). Foco: produtos modernos, padrões visuais comuns, fluxos centrais, o que não copiar, aplicação ao contexto IFP (ONG social, público vulnerável).

---

## Sumário cross-vertical (o que se repete)

| Eixo                  | Padrão dominante                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Paleta**            | Branco/cinza-claro dominante + 1 primária neutra (azul-petróleo, verde-musgo, roxo-suave) + 1 accent quente pequena. Nunca cor saturada como fundo. |
| **Tipografia**        | Sans-serif humanista (Inter, DM Sans, Manrope, Söhne). Nada de Roboto-padrão, nem fontes "arredondadas amigáveis" (Quicksand/Comic).                |
| **Densidade**         | Média-alta em telas operacionais (agenda, presença, prontuário). Whitespace generoso em onboarding/catálogo.                                        |
| **Cards**             | Raio 8–12px, sombra suave, sem flat brutalista.                                                                                                     |
| **Tom**               | Acolhedor profissional, não vendedor. "Vamos cadastrar?" em vez de "Iniciar processo".                                                              |
| **Mobile-first onde** | Presença/check-in/captura de foto. Painel operacional pode ser web.                                                                                 |
| **Privacidade**       | Crítica em recreativo (LGPD + criança) e esportivo (menor de idade). Autorização granular de imagem, número de staff protegido.                     |

---

## 1. Centro Médico

### Referências (não Amplimed)

- **Doctolib** (FR/DE/IT) — [doctolib.fr](https://www.doctolib.fr) — Referência global UX médico. Design system **Oxygen** público (Dribbble, Behance). Montserrat + Roboto, paleta azul/verde.
- **iClinic** (BR) — [iclinic.com.br](https://iclinic.com.br/software-medico/) — Mais reviewed do Brasil (Cloudia, Medway, GestãoDS). Integra com Memed. Tom acolhedor.
- **Doctoralia Pro** (BR/global, Docplanner) — [pro.doctoralia.com.br](https://pro.doctoralia.com.br/produtos/agenda-doctoralia-para-especialistas) — Agenda + WhatsApp + check-in online.
- **Elation Health** (US) — [elationhealth.com](https://www.elationhealth.com/solutions/ehr/) — Best in KLAS 2026 Small Practice. **"Three-panel console"**: histórico | nota atual | ações. AI scribing.

### Fluxos centrais

- **Agendamento** (Doctolib/Doctoralia): calendário semanal como tela #1 + fila do dia lateral; booking do paciente em wizard 3 passos.
- **Prontuário** (Elation/iClinic): 3 colunas — histórico esquerda, nota centro, ações direita. Sem tabs.
- **Prescrição/Encaminhamento** (iClinic+Memed): autocomplete + checagem de interação inline. PDF assinado.

### Aplicação ao IFP — 3 lições

1. **Tom acolhedor > clínico premium** — paleta azul-petróleo + verde-musgo + accent terroso (laranja queimado), não branco-azul-gélido Doctolib.
2. **Agenda + fila do dia como tela #1** — copiar Doctolib, é o que toda secretária já entende.
3. **Prontuário 3 colunas estilo Elation simplificado** — médico voluntário do IFP não usa AI scribing, então escopo enxuto.

---

## 2. Capacitação

### Referências

- **Disco** ([disco.co](https://www.disco.co/)) — Plataforma "Notion-like" para academias/bootcamps. Sidebar focada, blocos modulares, feed estilo Slack. Forte em white-label. [Design customization](https://www.disco.co/benefits/design-customization).
- **Thinkific Learner Hub** ([thinkific.com](https://support.thinkific.com/hc/en-us/articles/1500001538961-The-Classic-Student-Dashboard)) — Jan/2026 substituíram dashboard clássico por hub agregador: 1 porta de entrada do aluno.
- **Hotmart Club** ([hotmart.com](https://help.hotmart.com/pt-br/article/17310210527757/)) — Define vocabulário BR: **Trilhas de Conhecimento**, % progresso, dashboard de Insights.
- **Sponte by TOTVS** ([sponte.com.br/cursos](https://www.sponte.com.br/cursos)) — Mais perto do IFP (cursos livres, profissionalizantes, presença, certificado, NF). **Visual é "ERP educacional"** — pegar modelo de dados e fluxos, não o look.

### Fluxos centrais

- **Matrícula**: grade de cards (thumb + nome + vagas + horário) + filtros leves + página da turma + botão grande + 3 campos essenciais. Nunca 40 campos.
- **Aula (presença + conteúdo)**: tela do dia mobile-first com foto da turma, lista com toggle de presença em 1 toque, foto+observação. Trilha vertical numerada com check verde.
- **Conclusão/certificado**: 80% presença (regra CapacitaSUAS) → confetti + PDF com QR + share WhatsApp 1-clique.

### Aplicação ao IFP — 3 lições

1. **Aluno é beneficiário, não cliente** — sem "compra/oferta/upsell". "Quero participar" em vez de "Inscreva-se agora".
2. **Presencial primeiro, digital apoia** — mobile-first é a tela da Luciana fazendo presença na aula, offline-tolerante. Conteúdo digital é secundário.
3. **Trilha curta com fim claro** — "Você está no módulo 3 de 5 — formatura em 12/ago". Certificado tem peso emocional (primeiro da vida do aluno) — entrega cerimonial.

---

## 3. Recreativo / Creche / Educacional Infantil

### Referências

- **Brightwheel** ([mybrightwheel.com](https://mybrightwheel.com)) — Líder EUA (150k+ programas). App família + console educador. Captura de momento em 5–10s. Roxo/marinho clean.
- **Famly** ([famly.co](https://famly.co)) — UK/Dinamarca. Casinha+coração roxo. Observações de desenvolvimento, tradução ao vivo (literacia baixa).
- **ClassDojo** ([classdojo.com](https://www.classdojo.com)) — 50M+ alunos, gratuito. Mascote Mojo aparece pra aluno/responsável, **painel do professor é sóbrio**. Amarelo dourado #F7B100.
- **ClassApp BR** ([classapp.com.br](https://www.classapp.com.br)) — 600+ escolas. Substitui WhatsApp pessoal. _"Protege o número de telefone do staff"_ — exatamente o problema da Danielle.

### Fluxos centrais

- **Daily report ("Como foi o dia")** — educador captura foto + 2 tags + nota curta em 5–10s. Feed pro responsável.
- **Check-in/out** — QR/assinatura no tablet. Carimbo horário + notifica turma + registra quem retirou.
- **Mensagem direta família ↔ instituto** — 1:1 dentro do app. Killer feature ClassApp. Protege staff.
- **Ficha da criança** — responsáveis + autorizações granulares (foto, alergias, contatos emergência, lista quem pode retirar).

### Aplicação ao IFP — 3 lições

1. **Simplificar radicalmente o app do responsável** — máx 3 telas (feed, mensagem, ficha), ícones grandes + texto curto. **Fallback via WhatsApp Business** pra quem não instalar. Botão de áudio nativo.
2. **Privacidade de imagem é não-negociável** — autorização granular (interno OK / redes IFP não / imprensa não), revogável, assinada digital. Watermark invisível com ID do post.
3. **"Instituto sério que cuida com afeto"** — painel da Danielle = profissional/robusto. App do responsável pode ter toque de calor (acento quente, ilustrações geométricas). Mascote: opcional, só pro lado família/criança. Tipografia: sans-serif legível padrão, **sem Quicksand**.

---

## 4. Esportivo

### Referências

- **TeamSnap** ([teamsnap.com](https://www.teamsnap.com/)) — 25M+ usuários, 196 países. Roster, chat, presença, calendário. Tom **coach + família + jovem atleta** — institucional-amigável.
- **SportsEngine (NBC Sports Next)** ([sportsengine.com](https://www.sportsengine.com/)) — Plataforma NBC pra ligas amadoras. SportsEngine Play (streaming com gráficos on-screen). Ar de TV esportiva sem virar canal pago.
- **Heja** ([heja.io](https://heja.io/)) — App nórdico, gratuito tier base. Melhor benchmark de **safeguarding de menores**. Ilustrações em vez de fotos quando público é jovem.
- **Tecnofit / Next Fit / SporTI** — Trio BR (escolinhas de futebol/vôlei). Vocabulário em pt-BR e fluxos típicos (responsável, categoria, NF). **Visual datado** — copiar léxico, não o look.

### Fluxos centrais

- **Matrícula do aluno-atleta** — wizard 3 passos (dados do menor → responsável → modalidade/turma). Consentimento explícito.
- **Calendário de treinos + presença** — vista semanal/mensal Google-like. Presença em 1 toque pelo celular do coach.
- **Evolução** — perfil esportivo com histórico longitudinal: gráfico de presença + radar/barras (atributos físico/técnico/comportamental 1–5). Família vê versão simplificada.

### Aplicação ao IFP — 3 lições

1. **Privacidade radical de menor** — dados aluno separados dos do responsável; foto opt-in; nunca lista pública de menores. Heja é benchmark.
2. **Família é usuário primário** — portal simples pra ver presença + próximo treino + evolução em linguagem clara.
3. **Tom institucional-motivador** — paleta IFP (azul-marinho ou verde institucional + accent laranja/amarelo). "Acompanhe a evolução do seu filho" em vez de "Domine seus limites". Iconografia de modalidades unificada line-style. Nav enxuta: Turmas, Calendário, Presença, Evolução, Eventos, Galeria (máx 6).

---

## Decisões que essa pesquisa sugere

Para a próxima spec (arquitetura multi-tenant) e a spec subsequente (design system v2):

1. **Família tipográfica única cross-unidade** — Inter ou DM Sans pra UI. Identidade vem da cor primária por unidade, não da fonte.
2. **Paleta unificada com 4 acentos por unidade** — base institucional Pôncio (provavelmente azul-marinho ou verde institucional fechado) + 1 cor primária por unidade aplicada como accent + foto de drone com filtro daquela cor no login (briefing do Erick).
3. **Mascote do leão IFP** — entra no marketing público e em momentos cerimoniais (certificado, boas-vindas) — **não no painel operacional**.
4. **Telas-âncora por unidade** (a primeira que define a percepção):
   - Médico: agenda semanal + fila do dia
   - Capacitação: trilha do aluno + presença mobile
   - Recreativo: feed do dia da criança + mensagem família
   - Esportivo: calendário de treinos + evolução do atleta
5. **WhatsApp Business oficial do IFP como canal universal** — pra responsáveis e beneficiários com literacia digital baixa. Cobre Recreativo, Capacitação e Esportivo.
6. **Privacidade de imagem como módulo transversal** — autorização granular reutilizada em Recreativo e Esportivo (ambos atendem menores), aplicada na Ficha Cidadã onde já anonimizamos.

---

## O que esta pesquisa NÃO cobriu

- Custo: cada SaaS de referência tem modelo de preço (per-prof, per-aluno, freemium) — não interessa pro IFP (não vai contratar), mas pode interessar pro Saulo como benchmark de valor.
- Integrações específicas: Memed, BrasilAPI, Receita, gov.br Educa, etc — entrará na fase de implementação.
- Acessibilidade WCAG — assumido como requisito mas não detalhado.
- Análise crítica das próprias telas atuais do IFP Connect — feita separadamente; será comparada na spec de Design System v2.

---

**Próxima etapa:** essa pesquisa alimenta diretamente a spec de **Design System v2** (frente 4). Antes dela, a spec de **arquitetura de acesso multi-tenant + RBAC** (frente 2+3) precisa ser desenhada — está em brainstorming.
