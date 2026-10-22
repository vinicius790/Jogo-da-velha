# Escala

## O que existe hoje

- **Front-end**: arquivos estáticos. Qualquer hospedagem estática serve, sem servidor de aplicação.
  Toda a lógica (inclusive a IA) roda no aparelho do usuário.
- **Servidor de salas**: um processo Node, salas em um `Map` em memória.

## Limites do servidor atual

| Aspecto         | Situação                                                                            |
| --------------- | ----------------------------------------------------------------------------------- |
| Processos       | um só; duas instâncias não enxergam as salas uma da outra                           |
| Persistência    | nenhuma; reiniciar apaga as salas                                                   |
| Salas           | até `OMEGA_MAX_ROOMS` (500), cada uma com até `OMEGA_ROOM_LIMIT` (32) participantes |
| Custo por lance | validar a mensagem, aplicar no motor, enviar o snapshot a cada participante         |
| Carga           | **não medida**: não há teste de carga neste repositório                             |

O snapshot enviado a cada lance contém o histórico inteiro da partida. No pior caso (12×12, 144
lances) são alguns kilobytes por mensagem — aceitável para o uso previsto, desperdício em escala.

## O que seria preciso para escalar horizontalmente

Nada disto está implementado; é a lista do que mudaria:

1. Guardar as salas fora do processo (Redis ou banco) ou fixar cada sala em uma instância
   (roteamento pelo código da sala).
2. Canal de publicação entre instâncias para a difusão de `state` e `peer`.
3. Limites por IP compartilhados entre instâncias.
4. Enviar só o lance (delta) em vez do snapshot completo, mantendo o snapshot para quem entra.

Para um jogo da velha entre amigos, uma instância pequena basta.
