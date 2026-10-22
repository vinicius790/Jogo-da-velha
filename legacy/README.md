# Projeto original

Os três arquivos em `Jogo-da-velha-main/` são o jogo da velha que deu origem a este repositório:
uma página com Bootstrap (carregado por CDN), um script de 50 linhas e uma folha de estilo.
Ficam aqui por registro histórico; o app atual não depende deles.

Para ver funcionando, abra `Jogo-da-velha-main/index.html` no navegador (precisa de internet para
o Bootstrap).

Única alteração em relação ao original: o `style.css` usava sintaxe de Sass (`@mixin`,
`@include`, variáveis `$`) e importava arquivos que não existiam, de modo que o navegador
ignorava parte das regras. Foi reescrito em CSS válido, com o mesmo visual.
