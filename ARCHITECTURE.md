# Arquitetura do Sistema — OMEGA Tic-Tac-Toe

Este documento apresenta a arquitetura de software, o particionamento em camadas e a modelagem detalhada do módulo **Minimax Replay** do **Jogo da Velha (OMEGA Tic-Tac-Toe)**. Para uma consulta ainda mais aprofundada, veja também [docs/arquitetura/ARCHITECTURE.md](docs/arquitetura/ARCHITECTURE.md) e [docs/INDICE.md](docs/INDICE.md).

---

## 1. Visão Geral da Arquitetura e Camadas

O sistema foi concebido com estrita separação entre lógica de negócio (independente de DOM e executável em Node.js), interface reativa e serviços em background.

```mermaid
flowchart TD
    subgraph UI_Layer["Camada de Apresentação (src/ui/)"]
        DOMView["Views e Componentes DOM (board-view, replays, dashboard)"]
        Controllers["Controladores (game, replays, online, analytics, puzzles)"]
        DOMView <--> Controllers
    end

    subgraph Feature_Layer["Funcionalidades (src/features/)"]
        ReplayFeature["Replays (makeReplay, replayFrame, validateReplay)"]
        PuzzlesTournaments["Puzzles & Torneios"]
        ProgressionProfile["Progressão, Elo e Conquistas"]
    end

    subgraph Core_Layer["Núcleo Agnóstico de DOM (src/core/)"]
        GameEngine["GameEngine (Regras de Tabuleiro, Movimentos, Relógio)"]
        MinimaxAI["Motor de IA Minimax (alphaBeta, transposition, MCTS)"]
        MoveAnalyzer["Análise e Grader (reviewGame, classifyMove, summarize)"]
        Serialization["Serialização (JSON, JSONL, AES-256 Backup)"]
    end

    subgraph Worker_Layer["Execução Concorrente (src/workers/)"]
        AIWorker["AI Web Worker (Cálculo heurístico sem bloquear a UI)"]
    end

    subgraph Server_Layer["Multijogador (server/)"]
        WSServer["Servidor WebSocket (Salas, Relógio Autoritativo, Chat)"]
    end

    Controllers --> Feature_Layer
    Controllers --> Core_Layer
    Controllers --> Worker_Layer
    Controllers --> Server_Layer
    Feature_Layer --> Core_Layer
    Worker_Layer --> MinimaxAI
```

---

## 2. Módulo Minimax Replay & Auditoria de Lances

O módulo **Minimax Replay** atua na captura e conferência de partidas, na reconstrução instantânea de qualquer lance histórico e na avaliação heurística de decisões usando busca minimax com poda alpha-beta.

### 2.1 Fluxo de Execução do Replay (Flowchart)

```mermaid
flowchart TD
    subgraph Recording["1. Captura e Validação de Partida"]
        LiveMatch["Partida em Execução (GameEngine)"] --> ConcludeMatch["Término da Partida"]
        ConcludeMatch --> CreateReplay["makeReplay(state)<br/>Extrai Configuração e Lances [ { index, mark, turn } ]"]
        CreateReplay --> Validate["validateReplay(replay)<br/>Reconstrói o jogo e confere o vencedor declarado"]
        Validate --> SaveDB[("IndexedDB / Armazenamento Local")]
    end

    subgraph PlaybackSystem["2. Replay & Reprodução Passo a Passo"]
        SaveDB --> LoadReplay["Carregar Replay Selecionado"]
        LoadReplay --> Reconstruct["replayFrame(replay, turn)<br/>Reexecuta movimentos em nova instância GameEngine"]
        Reconstruct --> ActiveBoardState["Estado Exato do Tabuleiro no Lance N"]
    end

    subgraph MinimaxAudit["3. Auditoria Pós-Jogo via IA Worker"]
        ActiveBoardState --> SendWorker["AI Worker: postMessage('alphaBeta')"]
        SendWorker --> ComputeAlphaBeta["Busca Alpha-Beta + Tabela de Transposição<br/>Identifica Melhor Lance e Lances Alternativos"]
        ComputeAlphaBeta --> GradeMove["classifyMove(candidates, played)<br/>Calcula Perda de Avaliação: Best, Inaccuracy, Blunder"]
    end

    subgraph Visualization["4. Apresentação ao Jogador"]
        GradeMove --> RenderUI["Renderização com Destaques Visuais:<br/>• Lances ótimos recomendados<br/>• Salto rápido para próximo erro (nextMistake)<br/>• Curva de Vantagem"]
    end
```

### 2.2 Estrutura de Classes do Replay (ClassDiagram)

```mermaid
classDiagram
    class GameEngine {
        +string mode
        +GameConfig config
        +GameState state
        +play(index: number) boolean
        +undo() void
        +redo() void
        +timeout() void
    }

    class ReplayData {
        +string id
        +number createdAt
        +GameConfig config
        +string mode
        +string difficulty
        +string result
        +string endReason
        +string player
        +ReplayMove[] moves
    }

    class ReplayEngine {
        +makeReplay(state: GameState, player: string) ReplayData
        +replayFrame(replay: ReplayData, turn: number) GameState
        +validateReplay(replay: ReplayData) boolean
    }

    class MinimaxReviewer {
        +reviewGame(replay: ReplayData, options: ReviewOptions) GameReview
        +nextMistake(review: GameReview, currentTurn: number) number
    }

    class AlphaBetaSearch {
        +alphaBeta(board: Board, config: GameConfig, mark: string, options) SearchResult
        +scanPosition(board: Board, config: GameConfig) Evaluation
    }

    class MoveGrader {
        +classifyMove(candidates: Candidate[], playedIndex: number) string
        +outcomeClass(score: number) number
        +summarize(positions: PositionReview[]) ReviewSummary
    }

    class ReplaysController {
        -ReplayData activeReplay
        -number currentTurn
        -GameReview currentReview
        +loadReplay(id: string) void
        +stepForward() void
        +stepBackward() void
        +jumpToTurn(turn: number) void
        +goToNextMistake() void
    }

    ReplayEngine ..> ReplayData : manipula
    ReplayEngine ..> GameEngine : reconstrói
    MinimaxReviewer --> ReplayEngine : analisa
    MinimaxReviewer --> AlphaBetaSearch : executa
    MinimaxReviewer --> MoveGrader : classifica
    ReplaysController --> ReplayEngine : navega
    ReplaysController --> MinimaxReviewer : audita
```

### 2.3 Sequência de Execução de Análise (SequenceDiagram)

```mermaid
sequenceDiagram
    autonumber
    actor Player as Jogador
    participant UI as Replay View
    participant Ctrl as ReplaysController
    participant Rep as replay.js
    participant Rev as review.js
    participant Worker as Web Worker (alphaBeta)
    participant Grader as move-grader.js

    Player->>UI: Clicar em "Analisar com IA"
    UI->>Ctrl: analyzeActiveReplay()
    Ctrl->>Rev: reviewGame(replay)
    
    loop Para cada lance da partida (turn = 1 .. total)
        Rev->>Rep: replayFrame(replay, turn)
        Rep-->>Rev: boardState
        Rev->>Worker: alphaBeta(boardState, mark)
        Worker-->>Rev: searchResult (candidates, bestMove, score)
        Rev->>Grader: classifyMove(candidates, playedMove)
        Grader-->>Rev: grade ("best" | "good" | "inaccuracy" | "blunder")
    end

    Rev-->>Ctrl: GameReview (posições analisadas + sumário de precisão)
    Ctrl-->>UI: Exibe gráfico de vantagem e marcadores de lance no tabuleiro
    Player->>UI: Clicar em "Próximo Erro"
    UI->>Ctrl: nextMistake(currentReview, currentTurn)
    Ctrl-->>UI: Salta diretamente para o turno do deslize tático
```

### 2.4 Fluxo de Tomada de Decisão da IA Minimax (Flowchart)

```mermaid
flowchart TD
    Start["chooseMove(board, config, player, difficulty)"] --> Normalize["Normalização de Nível<br/>(Fácil, Médio, Imbatível)"]
    Normalize --> CheckBlunder{"Sorteio de Erro?<br/>(blunder > 0)"}
    CheckBlunder -- "Sim (Fácil: 35% / Médio: 12%)" --> RandomMove["Lance Aleatório Legal (random)"]
    CheckBlunder -- "Não" --> TacticalCheck{"Vitória ou Bloqueio Imediato?<br/>(exceto Misère)"}
    
    TacticalCheck -- "Vitória / Bloqueio" --> TacticalMove["Executa Lance Tático Imediato"]
    TacticalCheck -- "Sem tática imediata" --> CheckTablebase{"3×3 Clássico e<br/>Nível com Tablebase?"}
    
    CheckTablebase -- "Sim (Especialista / Imbatível)" --> TablebaseProbe["probe3x3: Consulta Solução Exata (O(1))"]
    CheckTablebase -- "Não" --> AlphaBetaExec["alphaBeta(board, config, player)<br/>• Aprofundamento Iterativo<br/>• Tabela de Transposição (Hash Zobrist)<br/>• Orçamento de Tempo / Profundidade"]
    
    AlphaBetaExec --> CheckMCTS{"Nível Imbatível (OMEGA)<br/>& MCTS Ativo?"}
    CheckMCTS -- "Sim" --> MCTSHybrid["MCTS Simulation (Desempate de Candidatos)"]
    CheckMCTS -- "Não" --> ReturnAlphaBeta["Retorna Melhor Lance da Busca"]
    MCTSHybrid --> FinalMove["Retorna Lance Avaliado pelo Ensemble"]
```

---

## 3. Pilares Arquiteturais do Sistema

### 3.1 Motor Minimax com Poda Alpha-Beta e Níveis Parametrizados
- **Fácil (`easy` / `facil`)**: Profundidade 1, taxa de erro deliberado de 35% (`blunder: 0.35`). Permite vitórias acessíveis para iniciantes.
- **Médio (`normal` / `medio` / `medium`)**: Profundidade 2, erro reduzido (`blunder: 0.12`), busca tática equilibrada sem tablebase.
- **Difícil (`hard`)**: Profundidade 4, taxa mínima de erro (`blunder: 0.03`).
- **Especialista (`expert`)**: Profundidade 6, erro zero (`blunder: 0`), consulta direta à `tablebase3x3` no tabuleiro clássico.
- **Imbatível (`omega` / `imbativel` / `unbeatable`)**: Profundidade até 10, tempo estendido, `tablebase3x3` e desempate com MCTS (Monte Carlo Tree Search) em tabuleiros maiores.

### 3.2 Tabuleiros Parametrizáveis e Modo 4×4 Opcional
- O `GameEngine` opera sobre tabuleiros de dimensão $N \times N$ ($3 \le N \le 12$), com suporte nativo a seleção rápida para o **modo 4×4**.
- O parâmetro `winLength` é dinamicamente ajustável de 3 até $N$.
- A validação em `validator.js` e a detecção em `win.js` suportam tabuleiros quadrados (`classic`, `misere`, `gravity`, `fade`) e axiais (`hex`).

### 3.3 Histórico com Replay Passo a Passo (Time Travel)
- **Reconstrução Determinística**: Ao invés de armazenar snapshots de matrizes em cada lance, o modelo grava apenas a lista linear de movimentos `{ index, mark, turn }`.
- **Navegação Temporal**: O método `replayFrame(replay, turn)` reconstrói em tempo linear qualquer ponto do tempo.
- **Controle Acessível**: Suporte a atalhos de teclado (Setas Esquerda/Direita, Home, End, Espaço) e auditoria pós-jogo (`reviewGame`) com salto automático para o próximo erro (`nextMistake`).

### 3.4 Estatísticas, Elo e Conquistas
- **Estatísticas Agregadas**: Registro de histórico, taxa de vitória, média de lances, sequências atuais e recordes.
- **Modelagem de Habilidade**: Implementação dupla de pontuação — Elo clássico e sistema probabilístico Glicko-2 (`rating`, `deviation`, `volatility`).
- **18 Conquistas Gamificadas**: Validadas puramente em `src/features/achievements.js` a partir de eventos de jogo (`first-win`, `streak-3`, `streak-7`, `streak-10`, `perfect`, `giant`, `omega`, `speed`, `variant-master`, etc.).

### 3.5 PWA (Progressive Web App) e Modo Offline
- **Service Worker Determinístico**: Injeção automática de manifest de precache durante o build Vite com hash SHA-256 de cada recurso estático gerado.
- **Funcionamento Offline**: Cache-first para assets locais e compatibilidade standalone com web app manifest.

### 3.6 Acessibilidade (W3C ARIA Grid e Teclado)
- **Estrutura Semântica**: `role="grid"` no container, `role="row"` nas linhas e `role="gridcell"` em cada célula com botões interativos.
- **Roving Tabindex**: Apenas uma célula do tabuleiro retém `tabindex="0"`, mantendo a navegação natural via Tab.
- **Navegação Completa por Teclado**:
  - `Setas Direcionais`: Navegação bidimensional entre células vizinhas.
  - `Home` / `End`: Salto para o início ou fim da linha atual.
  - `Ctrl + Home` / `Ctrl + End`: Salto para o primeiro (0, 0) ou último elemento do tabuleiro.
  - `PageUp` / `PageDown`: Salto para o topo ou base da coluna atual.
  - `Enter` / `Espaço`: Execução do lance.

---

## 4. Diretrizes de Engenharia e Princípios

- **Sem Frameworks no Core:** Todas as regras e algoritmos de busca residem em ECMAScript puro e não tocam propriedades do navegador (`window`, `document`, `navigator`), permitindo testes automatizados de alta performance com `node --test`.
- **Determinismo Absoluto:** Ao salvar uma partida, apenas as ações sequenciais são armazenadas. O estado do tabuleiro é sempre recalculado dinamicamente através do `GameEngine`, prevenindo inconsistências.
- **Não-bloqueio de Interface:** As buscas minimax operam de forma assíncrona dentro de Web Workers dedicados (`ai.worker.js`), garantindo taxa contínua de 60fps na renderização visual.
