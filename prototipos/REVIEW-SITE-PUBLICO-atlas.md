# Revisão de design — Site Público IFP

> ⚠️ **PROXY:** revisão das telas `publico-*` do **Atlas**, NÃO do site real deployado (https://ifp-app.taile04c66.ts.net, fora do ar). Reexecutar no site real quando voltar. · 2026-06-18 · só sugestões, nada alterado.

## Resumo
O site do IFP esta em bom patamar; melhorias pontuais e de alto retorno, sem reescrever o site.

## Top 5 melhorias (maior retorno)
1. **Foco de teclado visivel nos inputs** _( doe, voluntario, contato, como-ser-atendido )_ — Trocar outline none por outline solido na cor da unidade com offset; maior barreira de acessibilidade e ajuste trivial.
2. **Prova social humana na landing** _( publico-landing )_ — Bloco de depoimento com foto opcional, nome, servico e frase curta; gera identificacao que numero nao gera.
3. **CNPJ destacado na pagina de doacao** _( publico-doe )_ — Badge acima dos botoes de valor com instituto, CNPJ, OSC Registrada e deducoes para PJ.
4. **Alvos de toque adequados em mobile** _( telas com formulario ou botao )_ — Botoes 48px e inputs 44px com fonte 16px em telas pequenas; atende WCAG 2.5.5.
5. **Inverter cor dos CTAs do hero** _( publico-landing )_ — Como ser atendido em dourado e Apoie em outline, pois acessar importa mais que doar.

## O que já está ótimo (preservar)
- Paleta CASA aplicada com consistência total: dourado, marrom tinta, papel/tinta e cores de unidade respeitadas em todos componentes. Variáveis CSS bem nomeadas e coerentes.
- Tipografia Jost bem executada: pesos 300-700, upper cases estratégicos, letter-spacing correto em cada contexto (títulos, labels, corpo). Identidade clara, sem confusão de family.
- Escaneabilidade de formulários e CTAs impecável: botões btn-primary/btn-gold/btn-outline têm contraste forte, tamanho claro. Formulários respeitam .campo rigorosamente, fácil de scanear visualmente.
- Uso eficaz de pills, badges e labels para micro-navegação: palavras-chave (Saúde, Trabalho, Aberto, Urgente) e pills funcionam bem para categorizar áreas rapidamente sem poluir visual, especialmente em publico-voluntario.html.
- Hierarquia de CTAs bem definida com cores diferenciadas (dourado para apoiar/Jiu-Jitsu, primário para ações principais); doador/voluntário/beneficiário encontram seu botão no topo
- Jornada do beneficiário no 'Como ser atendido' é linear (4 passos), com FAQ em grid que antecipa objeções; nenhuma ambiguidade sobre como começar
- Proof social/impacto tangibilizado com números reais (1.342 famílias/mês, 92% direto aos programas) + mapping direto (R$ 30 = consulta odontológica); constrói confiança imediata
- Transparência pública em 'Como aplicamos' + 'Origem de recursos' em formato bar-chart legível; auditoria explicitada nos documentos (selos 'Auditado'); trata doador como parceiro informado
- Semântica HTML sólida com uso correto de headings (h1, h2), main e landmarks em todas as telas
- Viewport meta tag presente e grid system responsivo com breakpoints bem definidos (@media 1100px)
- Contraste de cores adequado no geral (ex: #752C05 sobre #FAF7F2 atende WCAG AA)
- Navegação consistente entre telas com padrões de link bem estabelecidos
- Ciclo de confiança completo: landing page comunica missão clara em 3 elementos (hero + 4 unidades + passo-a-passo), publico-como-ser-atendido desconstrói medos com FAQ honesta ('Não tem documento? Tudo bem') — tom acolhedor e realista.
- Transparência de impacto: publico-doe mostra conversão real (R$ 30 = 1 consulta) + públicamente em publico-transparencia (92% vai aos programas, auditoria visível, relatórios para download) — reduz ceticismo sobre uso de doações.
- CNPJ e assinatura em tela crítica: publico-verificar exibe CNPJ (12.345.678/0001-90), assinatura digital, data e hora de verificação — credibilidade máxima para empregadores validarem certificados.
- Microcopy orientador: 'Não precisa de encaminhamento', 'Tudo bem — venha mesmo assim', 'Sem compromisso — é só o primeiro passo' — reduzem fricção psicológica para famílias vulneráveis procurarem serviço.

## Achados por lente

### IDENTIDADE VISUAL & HIERARQUIA
- **[alta] Marca do leão ausente na primeira dobra** _( publico-landing.html, publico-doe.html, publico-unidades.html )_
  - Problema: O design system CASA menciona o leão como marca central, mas nenhuma tela exibe ilustração, brasão ou ícone do leão no hero. A primeira dobra é puramente textual, perdendo oportunidade de reforçar identidade visual e calor emocional esperado de um instituto social acolhedor.
  - Sugestão: Adicionar ícone/brasão simples com leão acima do eyebrow em publico-landing.html (elemento decorativo, não intrusivo). Em publico-doe.html, colocar um leão pequeno sutilmente ao lado ou acima do h1, já que é tela de ação importante para captação.
- **[media] Inconsistência de tamanho de fonte em textos descritivos (desc)** _( publico-como-ser-atendido.html, publico-voluntario.html (linhas 87), publico-doe.html )_
  - Problema: .desc usa 13px, mas parágrafos de contexto/corpo usam 18px (publico-landing.html linha 16) ou 15px. Em publico-como-ser-atendido.html FAQ (linhas 88-102), o conteúdo dos cards está em .desc (13px cinza), criando visual 'muito miúdo' para resposta de pergunta frequente. Hierarquia tipográfica fica confusa.
  - Sugestão: Padronizar: .desc = 13px APENAS para labels, meta-informações, data. Corpo de exposição/resposta = 15px com color:var(--corpo). Revisar publico-como-ser-atendido.html linhas 88-102: adicionar classes ou inline style 'font-size:15px; color:var(--corpo)' nas respostas de FAQ.
- **[media] Hero inconsistente entre landing e páginas internas** _( publico-unidades.html, publico-como-ser-atendido.html, publico-voluntario.html, etc )_
  - Problema: Landing (publico-landing.html) e Unidades (publico-unidades.html) usam hero idêntico em estrutura (80px padding, mesmos h1/p/botões). Visualmente, não há diferença entre 'home' e 'página interna', prejudicando orientação do usuário e hierarquia de importância.
  - Sugestão: Reduzir hero em páginas internas para padding:60px 40px (vs 80px), remover CTAs (botões já aparecem no final de seções). Mantém estrutura, sinaliza visualmente 'você é nível 2'. Ou adicionar indicator sutil (breadcrumb visual ou cor de fundo diferente).
- **[media] Hierarquia visual fraca em cards de Unidades: todas idênticas** _( publico-unidades.html (linhas 20-144) )_
  - Problema: Os 4 cards de unidades (publico-unidades.html) têm layout, peso visual e quantidade de conteúdo iguais. Um visitante em leitura rápida não consegue diferenciar prioridades. Não há ritmo visual nem ênfase que destaque qual unidade é 'ponto de entrada' vs 'complementar'.
  - Sugestão: Variar levemente: destacar Centro Médico visualmente (ex: card maior ou border dourada diferente), ou alterar ordem de elementos em 2 cards (lista de serviços antes da descrição) vs 2 outros. Cria ritmo sem quebrar design system. Alternativa: adicionar um ícone de unidade único acima do título em cada card.
- **[baixa] Ritmo vertical monótono: todas as .site-sec têm padding idêntico** _( publico-landing.html, todas as seções )_
  - Problema: Cada .site-sec usa padding:48px 40px. Sem variação de respiro. Uma landing acolhedora alterna seções 'aperto' (dados/cards) com 'abertura' (espaço branco). Agora tudo é uniforme, cria visual cansativo após scroll.
  - Sugestão: Não mexer no CSS base (já está pronto). Ao invés, documentar no design system futuro: aplicar padding variável por contexto: seção densa (cards) = 48px; seção respiro (KPI/números grandes) = 64px; seção transição = 56px. Isto exigirá classes como .site-sec--tight, .site-sec--open no próximo sprint.
- **[baixa] Confusão em uso de dourado para números KPI vs passos** _( publico-transparencia.html KPI (linhas 23-42), publico-doe.html (linhas 28-42) )_
  - Problema: Números em 'Como funciona' (landing linhas 49-62) são dourados (ênfase de passo). Números em KPI (publico-doe.html, publico-transparencia.html) usam .tinta (marrom). Mistura estratégia de cor: não fica claro se dourado = 'importante' ou se é contextual. Dilui impacto visual da cor.
  - Sugestão: Decisão de paleta: números de PASSO (1, 2, 3) → dourado (já está assim, manter). Números de DADO/IMPACTO (1.342 famílias) → marrom tinta. Números de VALOR (R$ 30) → dourado (já está). Manter coerente em todas as telas. Hoje está 90% certo; só revisar transparencia.html para consistência.
- **[baixa] Espaçamento do h1 ao eyebrow muito aperto em heroes grandes** _( publico-landing.html, publico-doe.html, publico-contato.html )_
  - Problema: .site-hero h1 tem margin:14px acima. Em telas grandes (1400px+), onde o h1 chega a 60px, esse gap de 14px fica desproporcionalmente pequeno. Visual de 'título solto', sem peso inicial. Não oferece respiro entre eyebrow e headline.
  - Sugestão: Mudar .site-hero h1 para margin: clamp(14px, 2vw, 28px) 0 0. Mantém proporção em todos os viewports: mobile 14px, desktop 28px. Ou simples: aumentar para margin:22px 0 0.

### UX & CONVERSÃO
- **[media] Botão de ação secundária 'Enviar interesse' sem entrega clara** _( publico-voluntario.html )_
  - Problema: Após submeter, não há confirmação visual (modal com 'Obrigado', timeline de contato, etc.). Voluntário fica na mesma página sem saber se foi enviado.
  - Sugestão: Implementar toast/modal de sucesso: 'Formulário enviado! Retornamos em até 48h pelo WhatsApp ou email que você informou'. Botão pode ficar desabilitado por 2s com ícone de check.
- **[media] Formulário de Contato sem roteamento de prioridade por assunto** _( publico-contato.html )_
  - Problema: Dropdown 'Assunto' tem 'Quero ser atendido' junto com 'Doações e parcerias', mas nenhuma indicação de que vai para filas diferentes ou tem SLAs diferentes (Serviço Social ≠ Captação).
  - Sugestão: Após selecionar Assunto, exibir inline: '[icone de telefone] Assunto: Acolhimento — Resposta mais rápida por (11) 3200-4100 entre 8h-17h'. Mantém gravidade do assunto clara e oferece alternativa de contato direto.
- **[media] CTA 'Quero ser atendido' com anchor confuso na landing** _( publico-landing.html )_
  - Problema: Beneficiário que quer ligar/marcar um horário precisa scrollar toda a página.
  - Sugestão: Adicionar modal ou seção acima do fold na landing com os 3 canais principais (Telefone Serviço Social + WhatsApp + Formulário expresso). Manter o botão, mas torná-lo ponto de entrada a esse 'hub de primeiro contato' antes de redirecionar para publico-como-ser-atendido.html.
- **[media] Fluxo de doação sem confirmação de valor customizado** _( publico-doe.html )_
  - Problema: Campo 'Outro' permite input livre, mas ao clicar em 'Continuar para o pagamento' não há feedback visual que registrou o valor customizado. Doador pode pensar que a doação não foi processada.
  - Sugestão: Ao selecionar ou digitar em 'Outro', exibir resumo ao lado (tipo: 'Sua doação: R$ [valor]') e mudar cor do botão 'Continuar' para ouro só após validação. No mobile, exibir expandido acima do botão.
- **[baixa] Criança no tatame (esporte) sem CTA visível na landing principal** _( publico-landing.html )_
  - Problema: Card 'Centro Esportivo' menciona 'Jiu-Jitsu' mas o CTA 'Como ser atendido' é genérico; pais buscando esporte específico não veem 'Quero inscrever meu filho no Jiu-Jitsu' como opção explícita. Fica colado à jornada genérica de acolhimento.
  - Sugestão: Na landing, após 'As quatro unidades', adicionar seção tipo: 'Procurando algo específico?' com CTAs micro (em outline): 'Enroll no Jiu-Jitsu', 'Matricular na creche', 'Fazer um curso'. Cada um leva direto à página de unidade + formulário de pré-inscrição.
- **[baixa] Voluntário sem visão clara do compromisso de tempo** _( publico-voluntario.html )_
  - Problema: O dropdown 'Disponibilidade' (Manhãs, Tardes, etc.) não deixa explícito quantas horas/semana se espera. Voluntário pode se inscrever achando que é pontual e depois ser esperado semanalmente.
  - Sugestão: Após selecionar disponibilidade, exibir tooltip ou expand-text: '(Típico: ~4h/semana)' + adicionar linha no card 'Onde precisamos' detalhando horas esperadas por função. Exemplo: 'Profissionais de saúde — 1-2 turnos/mês'.
- **[baixa] Transparência sem navegação comparativa (Doe vs. Unidades de Impacto)** _( publico-doe.html + publico-unidades.html )_
  - Problema: Página de Doe mostra 'R$ 30 = 1 consulta', mas não há link para ver a unidade Médica em detalhes. Doador engajado (que quer entender melhor onde o dinheiro vai) perde contexto.
  - Sugestão: No card de impacto 'R$ 30 — Saúde', adicionar ícone de link/seta e ao clicar, ir para publico-unidades.html#centro-medico (com hash) para aprofundar. Mesmo padrão para os 4 cards (Saúde → Médico, Creche → Educacional, Trabalho → Capacitação, Esporte → Esportivo).

### ACESSIBILIDADE & RESPONSIVIDADE
- **[alta] Tabela sem atributos scope nas colunas** _( publico-transparencia.html (linhas 91-93) )_
  - Problema: Tabela em publico-transparencia.html (linhas 90-131) usa <th> sem scope="col". Leitores de tela não conseguem mapear células às colunas corretas, afetando usuários com deficiência visual.
  - Sugestão: Adicionar scope="col" em cada <th>: <th scope="col">Documento</th> <th scope="col">Período</th> <th scope="col">Formato</th> etc.
- **[alta] Outline de foco invisível em inputs** _( publico-doe.html, publico-voluntario.html, publico-contato.html, publico-como-ser-atendido.html )_
  - Problema: Inputs têm outline:none e apenas border-color muda no :focus, insuficiente para navegação por teclado. Usuários com problemas de visão não conseguem localizar onde estão.
  - Sugestão: Substituir .campo input:focus por: border-color: var(--unidade); outline: 2px solid var(--unidade); outline-offset: 2px;
- **[media] Grid em mobile se colapsa sem margem inferior ajustada** _( publico-unidades.html (linhas 20-48), publico-doe.html (linhas 48-80), publico-voluntario.html (linhas 21-96), publico-contato.html (linhas 20-99) )_
  - Problema: @media 1100px reduz .g-60-40 e .g-50 para 1 coluna, mas gap não aumenta. Em telas muito pequenas (320px), cards ficam colados ou transbordam sem respiro visual.
  - Sugestão: Adicionar @media(max-width:768px) { .grid { gap: 24px; } .card { margin-bottom: 12px; } } e testar em 320px
- **[media] Avatares em lista sem rótulos acessíveis** _( publico-voluntario.html (linhas 62, 67, 72, 77), publico-contato.html (linhas 45, 50, 55, 60), publico-verificar.html (linhas 36) )_
  - Problema: .av com letras (SA, ED, CR, AD, DO) e .crest com iniciais não têm aria-label ou alt. Leitores de tela leem vazio, deixando usuários cegos sem saber quem é quem na lista.
  - Sugestão: Adicionar aria-label em cada avatar: <div class="av" aria-label="Saúde">SA</div> ou envolvê-los em <span role="img" aria-label="Profissionais de Saúde">
- **[media] Botões muito pequenos para toque em mobile** _( todas (publico-landing, publico-doe, publico-voluntario, publico-contato, etc.) )_
  - Problema: Botões com padding 13px 22px não atingem 48px de altura mínima (WCAG 2.5.5). Usuários com dificuldade motora ou em telas pequenas terão dificuldade de clicar com precisão.
  - Sugestão: Adicionar @media(max-width:768px) { .btn { min-height: 48px; padding: 16px 22px !important; } }
- **[media] Inputs e selects muito pequenos em mobile** _( publico-doe.html (linhas 54-59), publico-voluntario.html (linhas 27-30), publico-contato.html (linhas 73-86), publico-como-ser-atendido.html (linhas 72-76) )_
  - Problema: .campo input/select/textarea têm apenas padding:10px 12px. Em celulares, fica abaixo de 44px de altura, dificultando toque e leitura em fontes de baixa visão.
  - Sugestão: Adicionar min-height: 44px; padding: 12px 14px; e @media(max-width:640px) { padding: 14px 14px; font-size: 16px; } para evitar zoom automático
- **[baixa] Textos uppercase transbordam em mobile sem ajuste de letter-spacing** _( todas (headings h2 em: publico-landing, publico-unidades, publico-doe, publico-voluntario, etc.) )_
  - Problema: Headings com text-transform:uppercase e letter-spacing:.12em (ex: "COMO FUNCIONA O ACOLHIMENTO") transbordam em telas 320-360px. Padrão de baixa literacia acessa mais por celular.
  - Sugestão: Adicionar @media(max-width:640px) { h2, .titulo { letter-spacing: 0.02em; font-size: 18px; word-spacing: -0.1em; } }
- **[baixa] SVGs sem descrição ou aria-hidden** _( publico-contato.html (linha 32), publico-transparencia.html (linhas 99, 106, 113, 120, 127), publico-verificar.html (linhas 37, 44) )_
  - Problema: SVGs decorativos (mapa em contato, checkmarks em transparência, moldura de brasão) não têm <title> ou aria-hidden="true". Leitores de tela tentam ler elementos vazios.
  - Sugestão: Para SVGs puramente visuais: adicionar aria-hidden="true". Para SVGs informativos: adicionar <title>Mapa do Instituto</title> dentro do SVG ou aria-label no container.

### COPY & CONFIANÇA
- **[alta] CNPJ ausente na página de doação** _( publico-doe.html )_
  - Problema: publico-doe.html oferece 4 formas de doação (Pix, Transferência, Cartão) mas não exibe CNPJ de forma destacada. Mensagem final menciona 'organização sem fins lucrativos' e 'doações para PJ podem ser dedutíveis', mas cadeia de prova (CNPJ → nota fiscal → dedutibilidade) fica fraca.
  - Sugestão: Adicionar card/badge visual na seção 'Formas de doar' com: 'Instituto Família Poncio — CNPJ 12.345.678/0001-90 · OSC Registrada'. Ou criar linha-resumo acima dos botões de valor: 'Doação 100% segura · CNPJ verificado · Deduções fiscais para PJ'. Reforça credibilidade antes do clique.
- **[alta] Carência de depoimentos / prova social na landing** _( publico-landing.html )_
  - Problema: publico-landing.html mostra 1.342 famílias + 213 certificados, mas nenhuma voz real: sem quote de beneficiado, sem nome+foto de aluno que conseguiu emprego, sem relato de mãe na creche. Números geram confiança parcial; histórias geram identificação.
  - Sugestão: Adicionar 1 bloco 'Uma voz de quem foi atendido' com foto (optativa), nome completo, curso/serviço recebido e frase curtíssima (máx. 2 linhas). Ex: 'Fiz manicure aqui e agora tenho clientes meus — o Instituto não me deu só curso, deu dignidade.' (Rosa M., 2025). Não precisa de vídeo; texto+foto é suficiente.
- **[media] Falta elo entre 'Voluntário' e impacto — copy não converte** _( publico-voluntario.html )_
  - Problema: publico-voluntario.html: seção 'Onde precisamos de você' marca 'Profissionais de saúde' como 'Urgente' (vermelho), mas nenhum parágrafo explica *por que* é urgente ou que impacto direto terá. Voluntário potencial não vê 'sua ação = X crianças atendidas' ou urgência contextualizada.
  - Sugestão: Adicionar 1-2 frases antes da lista 'Onde precisamos': ex., 'Hoje 1.342 famílias dependem de nossa equipe. Você pode ajudar a ampliar esse atendimento doando suas horas. Veja onde mais precisamos:'. Ou marcar cada área com impacto micro: 'Dentistas — hoje faltam 2 profissionais / 120 crianças aguardam triagem'.
- **[media] Copy vaga em 'Horários' (unidades não aceitam informação prática)** _( publico-unidades.html )_
  - Problema: publico-unidades.html: cada unidade mostra horários em card-suave, mas sem info crítica: (1) 'Como agendar?' — há sistema de agendamento? (2) Precisa pré-cadastro? (3) Que dia da semana abre vaga? Centro Médico diz 'Seg a Sex 07h30-17h00' mas não diz se precisa ligar antes ou se chega e senta.
  - Sugestão: Estender microcopy nos horários: ex., 'Seg a Sex 07h30-17h00 — chegue a qualquer hora, sem agendamento' OU 'Seg a Sex 07h30-17h00 — agende pelo Serviço Social'. Ou criar campo separado 'Como agendar' com 1 frase clara. Remove fricção: família não fica em dúvida se pode ir.
- **[media] CTA 'Como ser atendido' invisível em landing / hierarquia confusa** _( publico-landing.html )_
  - Problema: publico-landing.html: botão 'Como ser atendido' é btn-primary (azul escuro) mas botão 'Apoie' é btn-gold (destaque), invertendo prioridade. Para nova família, a jornada de acesso importa mais que doação — mas visualmente é secundária.
  - Sugestão: Inverter cores dos CTAs na landing: 'Como ser atendido' → btn-gold (aqueça a jornada de entrada), 'Apoie' → btn-outline (doação vem depois, quando confiança existe). Ou usar texto diferenciado: 'Quero me atender' vs 'Quero ajudar'.
- **[baixa] Micro-copy 'Voltará em até 48h úteis' cria expectativa mas sem SLA visível** _( publico-contato.html )_
  - Problema: publico-contato.html: formulário promete 'retornamos em até 48h úteis', mas nenhuma página exibe SLA de resposta por canal. WhatsApp diz 'Online' (vago). E-mail diz 'Resposta em 48h' mas qual hora do dia? É promessa cumprida? Voluntário ou doador ansioso pode ficar frustrado.
  - Sugestão: Usar language mais precisa e prometedora: substituir '48h úteis' por '2 dias úteis, até 17h' ou '48h (respostas fora do horário são na segunda-feira seguinte)'. Ou criar badge visual na lista de canais: 'WhatsApp — resposta em até 2h (seg-sex 8h-17h)' vs 'E-mail — até 48h'. Torna expectativa realista e cumprívelemente.
- **[baixa] Transparência excelente, mas sem call-to-action para dúvidas sobre números** _( publico-transparencia.html )_
  - Problema: publico-transparencia.html mostra 92% vai a programas, 4 gráficos de origem e impacto 2025, relatórios com 'Auditado'. Excelente. Mas frase final 'Quer entender melhor algum número? Fale com a gente' usa link de contato genérico — usuário não sabe se vai falar com financeiro, assessoria ou suporte geral.
  - Sugestão: Criar micro-formulário ou link direto na página: 'Dúvida sobre transparência?' → botão 'Fale com nosso financeiro' (com e-mail: financeiro@familiaponcio.org.br ou destinação prévia no select). Ou mudar frase final para 'Dúvida sobre os números? Envie para [email dedicado] e respondemos em 48h.' Contextualiza a resposta.
