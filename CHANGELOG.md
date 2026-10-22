# Changelog
## Em desenvolvimento

### Adicionado

- **IA Minimax com Alpha-Beta e níveis parametrizados**: suporte e normalização com `DIFFICULTY_ALIASES` aos níveis **Fácil** (taxa de erro deliberado de 35%), **Médio** (busca tática equilibrada sem tablebase) e **Imbatível** (solução exata em 3×3 clássico via `tablebase3x3` e aprofundamento iterativo com MCTS).
- **Modo 4×4 opcional**: seleção direta de tabuleiro 4×4 com linha de vitória configurável (3 ou 4) em todas as variantes e motores de busca/análise.
- **Histórico com Replay Passo a Passo (Time Travel)**: navegação temporal determinística lance a lance com atalhos de teclado (Setas Esquerda/Direita, Home, End, Espaço para pausar/reproduzir) e auditoria tática pós-jogo com salto para o próximo erro (`reviewGame` / `nextMistake`).
- **Acessibilidade e Controles de Teclado**: conformidade W3C ARIA Grid expandida com suporte a `Home`, `End`, `PageUp`, `PageDown` e `Ctrl+Home` / `Ctrl+End`, além de roving tabindex e anúncios por voz/leitor de tela.
- **Série local melhor de 3/5/7 para dois jogadores**: placar agregado, alternância de X após cada partida concluída, empate sem ponto, configuração e relógio consistentes, retomada local e resultados recentes. Cada jogo continua usando o motor e o acervo de replays existentes; o modelo novo tem saneamento e testes próprios.
- **Documentação e CI/CD**: diagrama de fluxo de decisão da IA Minimax e detalhamento dos pilares arquiteturais em `ARCHITECTURE.md`, `README.md` atualizado e validação contínua em `.github/workflows/ci.yml`.

## 12.1.0 — 2026-10-03

Funcionalidades novas, com testes, i18n (pt-BR, en, es) e documentação.

### Adicionado

- **Modo contra o relógio**: tempo por lance (5 s a 60 s) e/ou por partida (1 a 10 min),
  escolhidos na aba Jogar. Quem estoura o tempo perde (inclusive no Misère); o HUD mostra o saldo
  de cada lado e destaca o lado que tem a vez quando faltam 10 s ou menos. Vale contra a IA e
  entre 2 jogadores; a partida retomada não desconta o tempo em que a página ficou fechada.
  Motor em `src/core/engine/clock.js`; `GameEngine` ganhou `timeout`, `checkClock`,
  `timeLeft` e `resumeClock`, e o estado ganhou `clock` e `endReason`.
- **Ranking local** por tamanho de tabuleiro e variante, guardado no perfil (`profile.ranking`):
  Elo próprio de cada quadro (só muda contra a IA), V-E-D, melhor sequência e as cinco melhores
  vitórias (menos lances, depois menos tempo). Entra no backup e na sincronização entre abas pelo
  mesmo saneamento do perfil. `src/features/ranking.js`.
- **Análise pós-jogo** (`src/core/analysis/review.js`): para cada posição, o lance jogado, sua
  nota, até três lances alternativos com a avaliação da busca alpha-beta e a leitura do
  analisador (avaliação estática e ameaças). Na aba Replays: botão **Analisar partida** (também
  no diálogo de fim de partida), navegação lance a lance, alternativas destacadas no tabuleiro e
  botão **Próximo erro**. Roda no Web Worker (tarefa `review`).
- **Variante hexagonal** (`hex`): tabuleiro em losango de hexágonos (coordenadas axiais), linha
  válida nas três direções entre casas vizinhas. Integrada ao motor, à detecção de vitória, à
  avaliação e às buscas da IA, ao validador de snapshots, à notação, aos replays, ao link de
  compartilhamento, ao servidor de salas e à interface (tabuleiro desenhado com hexágonos).
- **Salas online com espectadores e chat**: mensagem `chat` no protocolo (até 200 caracteres,
  texto limpo de caracteres de controle e invisíveis, limite de uma mensagem a cada 400 ms por
  participante), histórico das últimas 50 mensagens entregue a quem entra ou reconecta, nome de
  exibição opcional em `host`/`join`/`watch` e lista de jogadores e espectadores no aviso
  `peer`. No cliente: caixa de chat na sala e lista de presentes.
- **Relógio nas salas online**, controlado pelo servidor: quem cria a sala escolhe os limites
  (`clock` na mensagem `host`, validado no protocolo: 0 ou de 1 s até os limites do jogo). O
  relógio começa quando o segundo jogador entra, continua correndo se alguém cair e a derrota
  por tempo é decidida no servidor (verificação a cada 200 ms, e também no lance atrasado), que
  envia o resultado a jogadores e espectadores. As mensagens `room` e `state` trazem `serverNow`
  e `clockStarted`; o cliente usa a diferença de relógios só para exibir o tempo.
- **Moderação do chat**: quem criou a sala pode silenciar, liberar e expulsar espectadores
  (mensagem `moderate`). O expulso recebe `kicked` e a mesma origem não volta a assistir aquela
  sala. Filtro de spam: a mesma mensagem do mesmo participante (sem diferença de maiúsculas) é
  recusada por 30 s (`chat-repeated`). Botão **Ocultar chat** no cliente.
- **Puzzles hexagonais** (4×4 com linha de 3, 5×5 e 6×6 com linha de 4), também no desafio
  diário; as respostas são conferidas contra a busca alpha-beta nos testes.

### Alterado

- `gradeReplay` passou a usar `classifyMove`, compartilhado com a análise pós-jogo (mesmos
  critérios de antes).
- Conquista **Relâmpago** não é concedida a vitória por tempo.
- Derrota (ou vitória) no relógio **antes do primeiro lance** passa a contar no perfil, no
  ranking e nos replays. O histórico guarda `endReason`; vitória no relógio conta no V-E-D e no
  Elo do quadro, mas não entra nas "melhores vitórias".
- IA no hexagonal: o corte de candidatos em tabuleiros grandes usa a vizinhança hexagonal (seis
  vizinhas) em vez da quadrada, que incluía casas sem ligação com as peças.
- Lista de presentes da sala: `players` ganhou `id` e `watchers` passou de lista de nomes para
  `{ id, name, muted }` (o `id` público é o alvo da moderação).

### Corrigido

- Espectador cuja conexão caía não voltava à sala: o cliente mandava `resume` com um token que o
  servidor já tinha apagado. Agora o espectador volta com `watch`; o jogador continua com `resume`.
- **Refazer** depois de o tempo acabar lançava um erro não tratado e a tela não mostrava o fim da
  partida; agora termina no relógio como um lance comum.
- Chat e nomes: um emoji cortado ao meio no limite de 200 caracteres deixava um caractere inválido
  na mensagem; `cleanText` descarta surrogates soltos.
- `GameEngine.from` só aceita `endReason: 'timeout'` em partida vencida (numa abortada, o valor
  forjado bloqueava o desfazer); replays com `player` ou `endReason` inválidos são recusados.
- Tabuleiro hexagonal: o tamanho da casa vinha de um cálculo circular (o `100%` de
  `--board-side` era resolvido na própria casa) e às vezes encolhia o tabuleiro a casas de 2 px;
  agora vem da largura do tabuleiro (`container-type` + `cqi`).
- Tabuleiro hexagonal: a casa "levantava" 2 px no hover e, com o recorte em hexágono, o cursor
  nos cantos entrava e saía dela sem parar (a casa tremia). No hexagonal o hover só muda a cor.
- Sala online: ao sair (ou ser expulso), o aviso assíncrono "Conexão encerrada" sobrescrevia o
  status que a tela tinha acabado de mostrar.

## 12.0.0 — 2026-10-02

Revisão completa: correção dos defeitos encontrados em auditoria, funcionalidades que eram
fachada passaram a funcionar de verdade e o código foi reorganizado e formatado.

### Corrigido

- **Servidor**: uma requisição HTTP com alvo malformado derrubava o processo; agora recebe 404.
- **Servidor**: limite de salas por cliente (`OMEGA_MAX_ROOMS_PER_IP`, padrão 8); antes uma única
  conexão conseguia ocupar todas as salas por horas.
- **Servidor**: com `OMEGA_TRUST_PROXY=1`, o IP passa a ser o último de `X-Forwarded-For` (o que o
  proxy acrescentou), e não o primeiro, que o cliente pode forjar.
- **nginx**: `/sw.js` perdia os cabeçalhos de segurança, porque o `add_header` do `location`
  anulava os herdados do `server`.
- **IA**: cada nível tem força realmente diferente em qualquer tabuleiro. Antes, no 3×3 clássico
  todos os níveis jogavam perfeito e o parâmetro de erro (`noise`) nunca era lido.
- **Busca alpha-beta**: a tabela de transposição gravava valores obtidos com poda como exatos;
  agora guarda o tipo do valor (exato, limite inferior, limite superior).
- **Motor**: `redoMove` refaz vários lances em sequência; `reset()` zera o estado.
- **Desafio diário**: é um puzzle completo (antes quebrava a tela com `TypeError`); puzzles em
  3×3, 4×4, 5×5 e 6×6; qualquer lance vencedor é aceito.
- **Conquistas**: regras corrigidas (derrota não desbloqueia conquista de vitória) e todas as 18
  são avaliadas; o total exibido vem da lista.
- **Perfil**: partidas abertas por link, IA × IA e locais não alteram rating/XP; partidas online
  entram no histórico sem alterar o rating; o Elo é calculado contra o rating do nível da IA.
- **Glicko-2**: implementação refeita conforme o artigo de Glickman (a anterior misturava
  fórmulas do Glicko-1 e praticamente não alterava o rating).
- **Interface**: a tela inicial quebrava ao carregar (o histórico era desenhado em um elemento
  inexistente); métricas fixas ("100%", "120+") e o botão "Simular 10.000 partidas" (que rodava
  200, travando a página) deram lugar a medições reais feitas no Web Worker.
- **PWA**: o service worker listava arquivos de desenvolvimento que não existem no build; a lista
  de precache agora é gerada no build. Ícones do manifesto com caminho relativo.
- **Servidor**: dependência `ws` declarada; `OMEGA_CORS_ORIGIN` é lido e aplicado também à origem
  do WebSocket; espectadores são removidos ao desconectar; limite de mensagens e de conexões por
  IP; `resume` notifica a sala; a mensagem `peer` traz os campos que o cliente usa.
- **Estado**: mensagens do `BroadcastChannel` passam pelos mesmos validadores do backup; o perfil
  tem uma única definição.
- **Acessibilidade**: tabuleiro com `grid` → `row` → `gridcell`, foco preservado ao redesenhar.

### Adicionado

- Torneios jogáveis (pontos corridos contra três níveis da IA, com classificação e campeão).
- Interface completa em português, inglês e espanhol.
- Arena IA × IA com progresso e cancelamento; laboratório de motores com dados medidos.
- Reprodutor de replays com passo a passo, estudo de lances e exportação do acervo em JSONL.
- MCTS (UCT) usado pelo nível OMEGA para desempatar os melhores lances do alpha-beta.
- Tática imediata na avaliação das folhas da busca (vitória em um lance e ameaça dupla).
- Reconexão automática do cliente online; diálogo de senha para o backup cifrado.
- Testes de regressão para cada defeito corrigido, teste de integração do servidor e testes de
  ponta a ponta (incluindo uso offline).

### Alterado

- `src/main.js` (monolítico) dividido em controladores (`src/ui/controllers/`).
- Código formatado com Prettier; ESLint com as regras recomendadas.
- Versão com fonte única (`package.json`).
- Dependências: saíram `chart.js`, `dexie`, `socket.io-client`, `zod`, `@sinclair/typebox`,
  `vitest` e `typescript` (nunca foram usadas); `package-lock.json` versionado.
- Formato do backup: o estado fica em `state` (backups antigos, com `getState`, ainda abrem).
- Prefixo do código de compartilhamento: `OMEGA-S1` (links `OMEGA11` ainda abrem).

## 11.1.0

- Multiplayer autoritativo por movimentos com revisão, autenticação por token e reconexão.
- Salas com host/jogador/espectador e expiração automática.
- Analisador atualizado para respeitar movimentos legais de Gravity.

## 11.0.0

- Notação portátil de lances e explorador de aberturas.
- Rating com incerteza (Glicko) ao lado do Elo.
- Geração determinística de puzzles táticos.
- Prompt de instalação da PWA e cache offline.
- Correções na detecção de vitória em Gravity e na semântica do Misère.

## 10.0.0

- Reengenharia da aplicação original (três arquivos) em módulos: regras, IA, análise, puzzles,
  torneios, replay, PWA e multiplayer.
