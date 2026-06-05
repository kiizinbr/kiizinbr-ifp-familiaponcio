# Mapa de lacunas de produto — IFP Connect vs. sistemas de referência

**Data:** 2026-06-05 · **Método:** workflow multi-agente (2 mapeiam o estado atual no código · 2 levantam lacunas vs. referência · 1 crítico de completude). Baseado no código real, não em achismo.

**Referências:** Médico = EMR + gestão de consultório (Doctolib, Doctoralia, iClinic). Capacitação = LMS + secretaria acadêmica (Sponte, ClassApp, Thinkific).

---

## Diagnóstico em uma frase

O IFP Connect é **forte na operação interna** (cadastro, agenda, prontuário, encaminhamento, matrícula, presença — tudo real e bem-feito) e **quase vazio nas 3 camadas que fazem um sistema "parecer produto" pra fora**: **comunicação proativa**, **autoatendimento** e **relatórios/indicadores**. Sistemas de referência gastam metade do produto nessas três. É aí que mora a sensação de "falta coisa".

E há um ausente estrutural: **o beneficiário (paciente / aluna) não existe no sistema** — todo acesso é de staff. Quem mais "usaria" um produto de verdade hoje nem entra.

---

## Quem sente a falta (mapa por persona)

| Persona                                        | O que falta pra ela (hoje improvisa fora do sistema)                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Recepção (médico)**                          | Reagendar em 1 passo · painel único de balcão · check-in de chegada · disparar lembrete de consulta                                                  |
| **Médico**                                     | **Receita e atestado** (não fecha o atendimento no sistema → volta pro papel) · linha do tempo clínica · templates de evolução · autocomplete CID-10 |
| **Secretaria (capacitação)**                   | **Certificado** · **diário de classe** exportável · relatório de matrículas p/ editais · anexar documentos da matrícula                              |
| **Instrutor**                                  | Diário/folha de chamada · grade de horários · vínculo do próprio login · lançar nota                                                                 |
| **Gestor / Coordenação**                       | **Indicadores** (falta, evasão, ocupação, conclusão) · exportação CSV · alerta de evasão · tela de auditoria                                         |
| **Paciente / Aluna** _(não existe no sistema)_ | Confirmar/cancelar por link · ver sua frequência/situação · baixar certificado/receita · se inscrever sozinha                                        |

---

## As 5 lacunas ESTRUTURAIS (transversais — valem mais que features soltas)

O crítico de completude elevou estas de "feature isolada" para "infraestrutura". Cada uma serve as duas verticais e destrava dezenas de features.

1. **Motor de notificações (WhatsApp Business API + e-mail/SMS)** — fila, retry, templates versionados, log de entrega, consentimento por canal. Hoje só existe `wa.me` manual no funil. É o item nº 1: sem ele, nenhum "lembrete/aviso/confirmação" das duas verticais roda automático. Público de baixa literacia digital = WhatsApp é o canal universal.
2. **Motor de exportação (CSV/Excel/PDF) genérico** — exportar qualquer lista filtrada (cidadãos, consultas, matrículas, presenças). Hoje **zero** exportação; todo dado fica preso na tela. É o que instituto social usa pra prestar contas a edital/parceiro/prefeitura.
3. **Tela de auditoria (LGPD)** — a tabela `AuditLog` já grava tudo (quem abriu prontuário, alterou socioeconômico), mas **não há tela pra consultar**. Em domínio com dado de saúde e de menor, trilha de auditoria consultável é exigência de conformidade.
4. **Portal do beneficiário (autoatendimento)** — área onde o paciente/aluna acessa sozinho (confirmar consulta, ver frequência, baixar certificado, se inscrever). É o maior salto de "sistema interno" → "produto".
5. **Visão 360 cross-vertical do cidadão** — a mesma ficha atende todas as unidades, mas não há a timeline que cruza "a mãe tem consultas, a filha faz curso de costura, o filho passou pela triagem social". É exatamente o valor de ser multi-tenant integrado em vez de 4 sistemas soltos.

Outras categorias inteiras ausentes que o crítico achou: pesquisa de satisfação/NPS · gestão de salas/recursos como entidade reservável · app/PWA com captura offline (presença na sala sem wifi) · acessibilidade WCAG como requisito formal · notificações internas pra equipe (central de pendências) · consentimento de imagem/LGPD versionado e revogável · integrações gov (CNS/SUS/e-SUS, gov.br) · portabilidade LGPD (dossiê do titular).

---

## Buracos de "produto pronto" por vertical (os específicos de maior prioridade)

### Centro Médico

| Lacuna                                                                      | Quem            | Esforço | Prio     |
| --------------------------------------------------------------------------- | --------------- | ------- | -------- |
| **Receita médica** em PDF (card hoje inerte)                                | médico/paciente | L       | **alta** |
| **Atestado / declaração de comparecimento** em PDF (card inerte)            | médico/paciente | M       | **alta** |
| **Lembrete de consulta** WhatsApp com confirmação ativa                     | recepção/gestor | L       | **alta** |
| **Reagendamento em 1 passo**                                                | recepção        | M       | **alta** |
| **Painel da recepção** (balcão único)                                       | recepção        | L       | **alta** |
| **Indicadores** (comparecimento/falta/ocupação/espera)                      | gestor          | L       | **alta** |
| Linha do tempo clínica longitudinal                                         | médico          | M       | alta     |
| Pedido de exames · check-in · lista de espera/encaixe · autocomplete CID-10 | vários          | S–L     | média    |

### Capacitação

| Lacuna                                                                                   | Quem                 | Esforço | Prio        |
| ---------------------------------------------------------------------------------------- | -------------------- | ------- | ----------- |
| **Certificado** (regra 80% → PDF + QR/verificação)                                       | secretaria/aluna     | M       | **alta**    |
| **Trava de elegibilidade** (avisar antes de concluir com <80%)                           | coordenação          | S       | **alta**    |
| **Diário de classe** exportável (chamada + frequência)                                   | instrutor/secretaria | M       | **alta**    |
| **Relatório de matrículas** filtrável + CSV (editais)                                    | coordenação          | M       | **alta**    |
| **Grade de horários** da turma (dias/horário/sala, não só início/fim)                    | todos                | M       | **alta**    |
| **Gestão completa de instrutor** + vínculo de login                                      | coordenação          | S       | **alta**    |
| Notificação ao aluno (matrícula/vaga abriu) · alerta de evasão · importar CSV de verdade | vários               | S–L     | média       |
| Portal da aluna · inscrição online · nota/avaliação · ementa/materiais                   | aluna/instrutor      | M–L     | média/baixa |

---

## Recomendação — a "primeira onda"

Não atacar a lista inteira (paralisa). A sequência de maior alavancagem:

1. **Fechar os entregáveis finais que faltam** (o sistema "termina" no momento de maior valor): **certificado** (Capacitação) + **receita & atestado** (Médico). São os pontos onde hoje o usuário sai do sistema. Mesma lib de PDF serve aos dois.
2. **Motor de notificação WhatsApp** (transversal): destrava lembrete de consulta, confirmação de matrícula, "sua vaga abriu". É o que faz os dois módulos "ganharem vida" pra fora. Maior ROI percebido.
3. **Relatórios + exportação** (transversal): tira a cara de "só uma agenda/lista" e dá ao gestor o que ele leva pra reunião/edital.
4. **Tela de auditoria** (LGPD): barata, e é requisito de conformidade pro go-live com dado real (conecta ao gate de produção).

Depois disso: portal do beneficiário (o grande salto) e visão 360.

> **Ponto estratégico:** se for pra apostar em UMA coisa que muda a percepção de "produto", é a **camada de comunicação**. É transversal, é o que o mundo externo sente, e o público do IFP (WhatsApp-first) a torna ainda mais central.

---

## Conexões com o que já está em curso

- **Certificado** já era o próximo elo no handoff (F1.A.3).
- **Receita/atestado** já estavam mapeados (cards inertes "F1.B.3").
- **Consentimento LGPD versionado** aparece aqui E no gate de produção — é o mesmo trabalho.
- **Importar CSV de verdade** depende da Fase 1 (PII de 1064 alunas).
