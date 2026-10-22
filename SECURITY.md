# Segurança

## Relatar uma vulnerabilidade

Relate de forma privada ao mantenedor, pela aba **Security → Report a vulnerability** do
repositório no GitHub (ou por mensagem privada, se esse recurso não estiver habilitado). Não abra
issue pública com detalhes de exploração e nunca inclua segredos, tokens ou dados pessoais em
issues.

Inclua: o que acontece, como reproduzir e qual o impacto.

## Escopo

- O app web (pasta `src/`, `index.html`, `public/`).
- O servidor de salas (pasta `server/`).

Só a versão mais recente recebe correções.

## Modelo de segurança

O app não tem contas nem guarda dados sensíveis; os dados ficam no navegador do usuário. O que o
projeto se propõe a garantir, e o que fica fora de escopo, está em:

- [docs/seguranca-dados/SECURITY_MODEL.md](docs/seguranca-dados/SECURITY_MODEL.md)
- [docs/seguranca-dados/THREAT_MODEL.md](docs/seguranca-dados/THREAT_MODEL.md)
