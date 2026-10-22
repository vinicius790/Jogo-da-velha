# Índice da documentação

Tudo aqui descreve o que o código faz hoje (versão 12.1.0). Quando algo não existe ou não foi
medido, o documento diz isso explicitamente.

## `arquitetura/`

- [ARCHITECTURE.md](arquitetura/ARCHITECTURE.md) — camadas, regra de dependência e fluxo de uma jogada.
- [DATA_MODEL.md](arquitetura/DATA_MODEL.md) — formato do estado da partida, perfil, torneio e chaves de armazenamento.
- [LIBRARY_API.md](arquitetura/LIBRARY_API.md) — o que `src/index.js` exporta e como usar fora do app.
- [PLUGIN_SYSTEM.md](arquitetura/PLUGIN_SYSTEM.md) — não há sistema de plugins; onde mexer para estender.
- [REPLAY_FORMAT.md](arquitetura/REPLAY_FORMAT.md) — formato do replay, da notação e do JSONL.
- [PERFORMANCE.md](arquitetura/PERFORMANCE.md) — orçamentos de tempo da IA, Web Worker e tamanho do build.

## `ia/`

- [AI.md](ia/AI.md) — visão geral: os cinco níveis e a ordem de decisão.
- [AI_SEARCH.md](ia/AI_SEARCH.md) — alpha-beta, tabela de transposição e avaliação.
- [AI_MCTS.md](ia/AI_MCTS.md) — MCTS e o híbrido do nível OMEGA.
- [AI_TABLEBASE.md](ia/AI_TABLEBASE.md) — solução exata do 3×3.
- [AI_WORKER.md](ia/AI_WORKER.md) — execução no Web Worker.
- [AI_BENCHMARKS.md](ia/AI_BENCHMARKS.md) — resultados medidos de força e tempo.
- [STUDY_ENGINE.md](ia/STUDY_ENGINE.md) — classificação dos lances de um replay.

## `multiplayer-infra/`

- [MULTIPLAYER.md](multiplayer-infra/MULTIPLAYER.md) — protocolo de mensagens.
- [MULTIPLAYER_AUTHORITATIVE.md](multiplayer-infra/MULTIPLAYER_AUTHORITATIVE.md) — modelo de autoridade e checagens do servidor.
- [OPERATIONS.md](multiplayer-infra/OPERATIONS.md) — como rodar o servidor e variáveis de ambiente.
- [OBSERVABILITY.md](multiplayer-infra/OBSERVABILITY.md) — o que dá para observar hoje.
- [SCALING.md](multiplayer-infra/SCALING.md) — limites atuais e o que falta para escalar.
- [CONTAINERIZATION.md](multiplayer-infra/CONTAINERIZATION.md) — Dockerfile e docker-compose.
- [DEPLOY_GITHUB_PAGES.md](multiplayer-infra/DEPLOY_GITHUB_PAGES.md) — publicação do front-end.

## `produto/`

- [ACCESSIBILITY.md](produto/ACCESSIBILITY.md) — o que foi implementado e o que não foi testado.
- [INTERNATIONALIZATION.md](produto/INTERNATIONALIZATION.md) — como funciona a tradução e como adicionar um idioma.
- [COMPETITION.md](produto/COMPETITION.md) — torneios, ratings, conquistas e regras de registro.
- [LOCAL_MATCH.md](produto/LOCAL_MATCH.md) — séries locais, alternância de símbolos, placar e persistência.

## `qualidade-processo/`

- [TESTING.md](qualidade-processo/TESTING.md) — o que cada arquivo de teste cobre e como rodar.
- [STATIC_AUDIT.md](qualidade-processo/STATIC_AUDIT.md) — scripts de auditoria sem dependências.
- [VALIDATION.md](qualidade-processo/VALIDATION.md) — registro da última verificação executada.
- [RELEASE_CHECKLIST.md](qualidade-processo/RELEASE_CHECKLIST.md) — passos para publicar uma versão.
- [ROADMAP.md](qualidade-processo/ROADMAP.md) — o que não existe e poderia ser feito.

## `seguranca-dados/`

- [SECURITY_MODEL.md](seguranca-dados/SECURITY_MODEL.md) — fronteiras de confiança e controles.
- [THREAT_MODEL.md](seguranca-dados/THREAT_MODEL.md) — ameaças consideradas e riscos aceitos.
- [PERSISTENCE.md](seguranca-dados/PERSISTENCE.md) — onde e como os dados são gravados.
- [DATA_RESILIENCE.md](seguranca-dados/DATA_RESILIENCE.md) — falhas de armazenamento e recuperação.
- [BACKUP_SECURITY.md](seguranca-dados/BACKUP_SECURITY.md) — backup simples (soma de verificação).
- [SECURE_BACKUPS.md](seguranca-dados/SECURE_BACKUPS.md) — backup cifrado por senha.
- [OFFLINE_FIRST.md](seguranca-dados/OFFLINE_FIRST.md) — service worker e funcionamento offline.
