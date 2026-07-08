# Karick 🎯

Plataforma de quiz interativo em tempo real (estilo Kahoot). Monorepo TypeScript
com um servidor autoritativo via Socket.IO e dois front-ends: **Host** (tela
principal) e **Player** (mobile).

## Estrutura

```
karick/
├── packages/shared      # contrato de tipos + eventos (fonte da verdade)
└── apps/
    ├── server           # Socket.IO gateway + lógica de jogo (Node + tsx)
    ├── host             # front do apresentador (React + Vite, porta 5173)
    └── player           # front do jogador  (React + Vite, porta 5174)
```

## Como rodar (PoC)

O PoC usa estado **em memória** — não precisa de Docker/Redis/Postgres ainda.

```bash
npm install          # instala todos os workspaces
npm run dev          # sobe server + host + player em paralelo
```

Depois:

1. Abra o **Host** em <http://localhost:5173> → aparece um **PIN**.
2. Abra o **Player** em <http://localhost:5174> (ou no celular na mesma rede)
   → digite o PIN + um apelido.
3. No Host, clique **Iniciar**; responda no Player; use **Próxima** entre perguntas.

Rodar apps individualmente: `npm run dev:server`, `npm run dev:host`, `npm run dev:player`.

## Arquitetura

- **Servidor autoritativo**: clientes só emitem intenções; o servidor valida,
  cronometra e calcula pontuação. Previne trapaça e mantém tudo sincronizado.
- **`packages/shared`**: tipos dos eventos Socket.IO usados nos dois lados —
  payload errado quebra o build, não a produção.
- **Estado vivo** (sala, jogadores, respostas) fica na memória (PoC) →
  migrar para **Redis**. **Dados duráveis** (quizzes, histórico) → **PostgreSQL**.

## Roadmap de robustez

- [ ] Trocar `InMemoryRoomStore` por implementação Redis (`RoomStore` já é interface).
- [ ] `@socket.io/redis-adapter` para escala horizontal.
- [ ] Timer resiliente (BullMQ) em vez de `setTimeout` numa única instância.
- [ ] Reconexão do Player via `playerId` em `localStorage`.
- [ ] Autenticação do Host (JWT) + rate limiting + validação de payload (Zod).
- [ ] Persistir `GameResult` no Postgres (Prisma) ao fim do jogo.

## Infra (para as próximas etapas)

```bash
npm run infra:up     # Postgres :5432 + Redis :6379
npm run infra:down
```
