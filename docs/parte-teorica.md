<!--
  RASCUNHO. REVISAR ANTES DE ENTREGAR (este comentário não aparece no Markdown renderizado).
  Suposições sobre a rotina que precisam ser confirmadas ou corrigidas:
  - Seção 1: horários (início ~8h, trabalho indo até 22h/23h), nº de clientes, canais (WhatsApp/Slack/e-mail), sono ~6h.
  - Seção 1: a estimativa "~40% do dia em interrupções" é percepção, não medição. Ajuste ou retire.
  - Seção 7: as metas são sugestões. Se já tiver usado o sistema por alguns dias, troque por números reais do Painel.
  Apague este comentário depois de revisar.
-->

# Meu Sistema Operacional Pessoal: utilizando IA para gerenciar tempo, comunicação e produtividade

**Disciplina:** Produtividade e Gestão do Tempo
**Aluno:** Gustavo Martins
**Entregável 1:** Parte teórica (análise e discussão)
**Sistema desenvolvido:** Órbita, disponível em https://orbita.gustavomartins.dev

---

## 1. Diagnóstico da rotina atual

Sou desenvolvedor full-stack e divido a semana entre três frentes que competem pelo mesmo tempo:

- **Projetos de clientes**: manutenção e evolução de sistemas de gestão (um ERP, um CRM) e o site/app de outro cliente. Cada cliente tem seu canal (WhatsApp, e-mail, grupo), seu ritmo e sua urgência.
- **Faculdade**: uma disciplina por mês, com entregas práticas que eu levo a sério como peças de portfólio, e aulas ao vivo à noite.
- **Vida pessoal**: tarefas administrativas (nota fiscal, impostos, contas), saúde, família.

Antes de montar o sistema, observei minha rotina por uma semana e anotei como o tempo realmente era gasto. O padrão foi este:

| O que acontecia | Consequência |
|---|---|
| As demandas chegavam por 4 ou 5 canais diferentes e ficavam "na cabeça" ou em mensagens marcadas como não lidas | Coisas esquecidas, e a sensação constante de estar devendo algo |
| O dia começava respondendo mensagens, não trabalhando no que era importante | As manhãs, meu melhor horário, iam embora com o que era urgente para os outros |
| Troca de contexto frequente: um bug do cliente A no meio de uma feature do cliente B | Muito retrabalho pra "recarregar" o contexto; na minha percepção, perto de 40% do dia se perdia em interrupções |
| Não existia planejamento semanal: cada dia era decidido na hora | Tarefas grandes e sem prazo (documentação, estudo, testes) eram adiadas indefinidamente |
| O que atrasava durante o dia era compensado à noite, depois da aula | Dormir por volta de 6 h, cansaço acumulado, pior foco no dia seguinte |
| Reuniões e chamadas sem pauta, marcadas por hábito | Blocos de foco quebrados em pedaços de 30–40 min |

## 2. Principais desafios de produtividade identificados

1. **Sobrecarga de entrada (captura).** Sem um lugar único para registrar demandas, a memória vira a lista de tarefas. Isso gera ansiedade e esquecimento. É o que o GTD chama de "*open loops*": compromissos não registrados que continuam ocupando atenção.
2. **Priorização reativa.** Tudo que chega parece urgente. Eu vivia no quadrante "urgente e importante" da matriz de Eisenhower, e o trabalho importante e não urgente (Q2: testes, documentação, estudo, prevenção) nunca acontecia. E é justamente o Q2 que evita os incêndios seguintes.
3. **Fragmentação da atenção.** Interrupções e troca de contexto impediam o *deep work* (Newport), justamente o tipo de trabalho que desenvolvimento de software exige.
4. **Estimativas otimistas.** Planejava o dia como se ele tivesse 10 horas livres, ignorando reuniões, aulas e imprevistos (a *falácia do planejamento*). Resultado: frustração diária e sensação de improdutividade mesmo tendo trabalhado muito.
5. **Procrastinação de tarefas grandes.** Tarefas mal definidas ("fazer o trabalho da faculdade") são intimidadoras e ficam para depois. Tarefas definidas como próxima ação ("escrever a seção 2 do documento") começam mais fácil.
6. **Comunicação ineficiente.** Mensagens longas e sem objetivo claro geravam idas e vindas; reuniões substituíam o que poderia ser resolvido por escrito.
7. **Bem-estar tratado como sobra.** Sono, pausas e exercício só entravam se sobrasse tempo, e nunca sobrava. Isso tem custo direto na produtividade e é fator de risco para esgotamento.

## 3. Métodos utilizados

O Órbita combina métodos complementares, cada um resolvendo um dos desafios acima:

### GTD: Getting Things Done (David Allen)
Usado como **espinha dorsal do fluxo**: *capturar → esclarecer → organizar → refletir → executar*.
- **Capturar:** a caixa de entrada do Órbita aceita várias ideias de uma vez, uma por linha, sem pedir classificação. O objetivo é tirar da cabeça em segundos.
- **Esclarecer:** cada item vira uma **próxima ação** concreta, começando com verbo ("Enviar relatório de estoque ao cliente", e não "relatório estoque").
- **Organizar:** projeto, contexto (@computador, @telefone, @rua) e prazo.
- **Refletir:** revisão semanal no Painel.

### Matriz de Eisenhower (e o Quadrante 2 de Covey)
Usada para **priorizar**. As tarefas ficam num quadro 2×2: Q1 fazer agora, Q2 agendar, Q3 delegar/agrupar, Q4 eliminar. O Painel mede **quanto do tempo de foco foi para Q2**, com meta de pelo menos 50%, porque, como defende Stephen Covey, é nesse quadrante que está o trabalho que reduz os urgentes futuros.

### Técnica Pomodoro (Francesco Cirillo)
Usada para **executar e medir**. Blocos de 25 minutos de foco com pausa de 5 minutos, e pausa longa de 15 minutos a cada 4 blocos. No Órbita o timer é vinculado a uma tarefa, e cada pomodoro vira dado: horas de foco por projeto, por quadrante e por dia. Pomodoros **interrompidos** também são registrados, porque a taxa de interrupção é um dos indicadores mais reveladores. A estimativa das tarefas também é feita em pomodoros, o que torna o planejamento concreto ("cabem 6 pomodoros na quarta").

### Planejamento semanal com *time blocking* e capacidade realista
Toda semana as tarefas são distribuídas pelos dias, respeitando uma **capacidade diária** (8 pomodoros por padrão) da qual se descontam as reuniões **dentro do expediente** (cada hora de reunião consome cerca de 2 pomodoros), com **20% de folga** para imprevistos. A barra de carga de cada dia fica vermelha quando há sobrecarga. É a forma prática de combater a falácia do planejamento.

### Check-in diário de bem-estar
Registro de energia (1–5), humor (1–5), horas de sono e hábitos (água, pausa longe da tela, exercício, desligar às 19h, leitura). Leva menos de 30 segundos e, acumulado, mostra a relação entre carga de trabalho e bem-estar.

## 4. Ferramentas escolhidas e justificativa

| Ferramenta | Por que foi escolhida |
|---|---|
| **Órbita (app próprio)** | Nenhuma ferramenta pronta juntava os cinco métodos acima num fluxo único, com os indicadores que eu queria medir (foco por quadrante, interrupções, energia × carga). Como sou desenvolvedor, construir o sistema também foi uma forma de aplicar os conceitos da disciplina de ponta a ponta. |
| **Google Agenda** | É onde meus compromissos já estão (reuniões de clientes, aulas). Em vez de duplicar, o Órbita lê a agenda pelo endereço iCal secreto e usa os compromissos para calcular a capacidade real de cada dia. |
| **Notion** | Uso o Notion como "segundo cérebro" e consulta pelo celular. O Órbita cria automaticamente um banco "Órbita — Tarefas" e espelha nele as tarefas com status, quadrante, projeto, prazo e estimativa. |
| **OpenAI (modelos GPT)** | Modelo de linguagem usado como copiloto nas etapas que dão mais trabalho mental: esclarecer itens, montar a semana, redigir mensagens e revisar a semana. Escolhido pela qualidade em português e pelo suporte a **saída estruturada** (a resposta volta em JSON validado, e não só como texto solto). O sistema foi feito para não depender de um único fornecedor: o mesmo fluxo também roda no Claude, da Anthropic, trocando só a configuração. |

Avaliei também Trello (bom para Kanban, fraco para planejamento por capacidade e métricas), Asana (robusto, mas pensado para equipes) e Microsoft To Do (simples demais para priorização por quadrante). Os conceitos que eles ensinam foram incorporados: quadros visuais do Trello, visão por projeto do Asana e lista "Meu Dia" do To Do, que virou a tela "Hoje".

## 5. Como a IA foi utilizada para apoiar a organização

A IA aparece em cinco pontos do fluxo, sempre com o mesmo princípio: **a IA propõe, eu decido.**

1. **Triagem da caixa de entrada.** Recebe os itens crus ("cliente do ERP pediu relatório de estoque parado até sexta") e devolve, para cada um, a próxima ação reescrita, o quadrante de Eisenhower com justificativa, a estimativa em pomodoros, o contexto, o projeto e o prazo (convertendo "sexta" na data real). Tudo aparece em campos editáveis e só é gravado quando eu clico em "Aplicar".
2. **Planejamento semanal.** A IA recebe as tarefas abertas, os compromissos da semana, a capacidade diária e a **energia média dos últimos check-ins**. Com isso monta uma proposta: Q1 no começo da semana, Q2 em blocos de foco pela manhã, Q3 agrupado, e alertas de prazos em risco e de sobrecarga. Se minha energia está baixa, ela é instruída a aliviar a carga.
3. **Comunicação.** Transforma anotações soltas em mensagens claras em cinco formatos: atualização de status, resposta assíncrona, negociação de prazo ou escopo, "dizer não" com alternativa, e ata de reunião com decisões e responsáveis.
4. **Standup diário.** Gera o "ontem / hoje / impedimentos" a partir do que foi realmente registrado no sistema, pronto para colar no Slack.
5. **Revisão semanal.** Lê os números da semana e escreve a revisão: vitórias, para onde foi o tempo, energia e bem-estar, **três ajustes pequenos e verificáveis** e o compromisso da próxima semana.

**Uso consciente da tecnologia.** Alguns cuidados foram tomados deliberadamente:
- **Proibição de inventar:** o assistente de comunicação não cria datas, números ou fatos. O que faltar vira um marcador `[ASSIM]` e aparece num aviso "Revise antes de enviar".
- **Transparência:** cada resultado mostra qual IA e qual modelo o geraram (ou se veio do modo heurístico), e há um registro de todos os usos da IA.
- **Independência:** se a IA estiver indisponível, cada função tem uma alternativa por regras (palavras-chave, ordenação por prazo e quadrante), e o sistema continua funcionando.
- **Privacidade:** a chave da API e os tokens das integrações ficam só no servidor; o navegador nunca fala direto com a OpenAI, o Google ou o Notion.

## 6. Estratégias adotadas

### 6.1 Para melhorar a comunicação
- **Comunicação assíncrona por padrão:** perguntas que não precisam de conversa em tempo real são resolvidas por escrito, com uma mensagem completa em vez de "oi, tudo bem?" seguido de espera. Protege os blocos de foco dos dois lados.
- **Informação principal na primeira frase** e pedidos explícitos com responsável e data. A IA aplica essa estrutura em todas as mensagens.
- **Status proativo:** o standup gerado a partir dos dados reduz as cobranças ("como está aquilo?") porque o cliente já recebe a atualização.
- **Saber dizer não, ou "agora não":** um formato dedicado para recusar ou adiar demandas oferecendo alternativa, preservando a relação.
- **Atas com decisões e responsáveis:** reuniões terminam com registro claro, evitando uma segunda reunião para "relembrar o que foi combinado".

### 6.2 Para reduzir a procrastinação
- **Próxima ação concreta:** tarefas começam com verbo e são pequenas o bastante para iniciar. O plano semanal alerta quando uma tarefa é maior que o espaço livre de qualquer dia e sugere quebrá-la.
- **Regra dos 25 minutos:** começar um único pomodoro é um compromisso pequeno; o botão ▶ ao lado de cada tarefa remove a fricção de começar.
- **Captura imediata:** o que surge durante o foco vai para a caixa de entrada em segundos, sem interromper o bloco (e sem o esforço de "não esquecer", o efeito Zeigarnik).
- **Visibilidade do Q2:** o indicador "% do foco em Q2" deixa explícito quando o importante está sendo adiado.
- **Planejamento com folga:** um plano realista é mais fácil de cumprir; cumprir o plano reforça o hábito de planejar.

### 6.3 Para preservar a saúde mental
- **Pausas obrigatórias:** o timer entra em pausa sozinho após cada pomodoro, com notificação lembrando de levantar e olhar longe da tela.
- **Limite de horário:** o Painel conta os **pomodoros fora do expediente**, e "Desligar às 19h" é um hábito acompanhado. Trabalho à noite deixa de ser invisível.
- **Check-in de energia e humor:** 30 segundos por dia que, somados, mostram tendências e alimentam o planejamento (energia baixa → semana mais leve).
- **Capacidade como limite, não como meta:** a barra de carga mostra sobrecarga antes que ela aconteça.
- **Revisão semanal com olhar para o bem-estar:** a IA relaciona energia, humor e sono ao volume de trabalho e aponta sinais de sobrecarga com cuidado, sem tom clínico. O sistema não substitui acompanhamento profissional, mas torna visível o que antes passava despercebido. A OMS reconhece o *burnout* como fenômeno ocupacional (CID-11, QD85), resultado de estresse crônico no trabalho não gerenciado com sucesso.

## 7. Indicadores acompanhados e metas

O Painel foi desenhado para responder, com dados, se o sistema está funcionando:

| Indicador | Por que importa | Meta |
|---|---|---|
| Horas de foco na semana | Tempo de trabalho profundo efetivo | Crescer semana a semana até ~20 h |
| % do foco em Q2 | Mede se o importante está sendo feito antes de virar urgente | ≥ 50% |
| Taxa de interrupção dos pomodoros | Fragmentação da atenção | < 15% |
| Plano cumprido (planejadas × concluídas) | Realismo do planejamento | ≥ 70% |
| Pomodoros fora do expediente | Limites de horário | 0 na maior parte das semanas |
| Energia, humor e sono (tendência) | Sustentabilidade da rotina | Tendência estável ou de alta; sono ≥ 7 h |
| Hábitos cumpridos | Bem-estar na prática | ≥ 70% dos dias |
| Sequência de check-ins | Consistência do próprio sistema | Todos os dias úteis |

## 8. Conclusão

O principal aprendizado é que produtividade não é fazer mais coisas, e sim **fazer as coisas certas, com foco, de um jeito que dê para sustentar**. Minha rotina já tinha esforço de sobra; faltavam um lugar único para as demandas, um critério de prioridade, um plano que respeitasse a capacidade real e alguma forma de enxergar o custo pessoal do ritmo.

A tecnologia, e a IA em particular, entrou para **reduzir o trabalho mental de organizar** (esclarecer, estimar, distribuir, redigir, revisar), não para decidir por mim. O Órbita não é uma ferramenta a mais para gerenciar; é o sistema que integra as ferramentas que eu já usava (Google Agenda e Notion) a métodos consolidados (GTD, Eisenhower, Pomodoro, revisão semanal) e aos indicadores que mostram, semana a semana, se a rotina está ficando mais produtiva e mais saudável.

## Referências

- ALLEN, David. *A arte de fazer acontecer: o método GTD*. Rio de Janeiro: Sextante, 2016.
- CIRILLO, Francesco. *A Técnica Pomodoro*. Rio de Janeiro: Sextante, 2019.
- COVEY, Stephen R. *Os 7 hábitos das pessoas altamente eficazes*. Rio de Janeiro: BestSeller, 2017. (Hábito 3: "Primeiro o mais importante".)
- NEWPORT, Cal. *Trabalho focado (Deep Work)*. Rio de Janeiro: Alta Books, 2018.
- ORGANIZAÇÃO MUNDIAL DA SAÚDE. *Burn-out an "occupational phenomenon": International Classification of Diseases*. Genebra: OMS, 2019.
- ATLASSIAN. *Trello Guide*. Disponível em: https://trello.com/guide.
- ASANA. *Asana Academy*. Disponível em: https://academy.asana.com.
- NOTION. *Notion Help Center & Guides*. Disponível em: https://www.notion.so/help.
- OPENAI. *OpenAI API Documentation: Structured Outputs*. Disponível em: https://platform.openai.com/docs.
- Material da disciplina *Produtividade e Gestão do Tempo*: Gestão do Tempo, Comunicação, Saúde Mental e Bem-Estar no Trabalho.
