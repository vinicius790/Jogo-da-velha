# Roadmap

Lista do que **não existe** hoje e faria sentido, em ordem aproximada de retorno. Nada aqui é
compromisso.

## Jogo e IA

- Força em tabuleiros grandes: ordenação de lances por ameaças, busca de ameaças forçadas e
  janela estreita na raiz (PVS). Hoje a IA em 8×8 ou mais é só razoável.
- Reavaliar o desempate por MCTS do nível OMEGA: as medições não mostram ganho consistente sobre o
  Especialista. Ou melhorar as simulações, ou dar o tempo extra ao alpha-beta.
- Escolha de quem começa (hoje X sempre começa) e revanche com cores trocadas.
- Puzzles de dois lances e puzzles em Gravity/Misère.
- Busca na análise pós-jogo com profundidade/tempo escolhidos pelo usuário.

## Competição

- Torneio em mata-mata e escolha dos participantes.
- Rating online (exige contas e um servidor que guarde ratings).

## Online

- Persistência das salas e mais de uma instância (ver `docs/multiplayer-infra/SCALING.md`).
- Logs e métricas no servidor.
- Enviar só o lance em vez do snapshot completo.
- Denúncia de mensagens e persistência do histórico do chat.

## Plataforma

- Ícones PNG de 192 e 512 px para o manifesto (instalação em navegadores que exigem PNG).
- Aviso de "nova versão disponível" quando o service worker atualiza.
- Regras de plural no i18n; revisão das traduções por falantes nativos.
- Auditoria de acessibilidade com leitor de tela e medição de contraste.
- Importação do acervo em JSONL.

## Código

- Verificação de tipos com JSDoc + `tsc --checkJs` (o `tsconfig.json` atual só orienta o editor;
  o TypeScript não é dependência do projeto).
- Testes unitários dos controladores da interface.
- Medição de cobertura de testes.
