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

## Deploy (produção, servidor único)

Em produção, o servidor Node serve os dois front-ends compilados **e** o
WebSocket na mesma origem — uma URL só:

- `/`      → tela do Jogador (Player)
- `/host`  → tela do Apresentador (Host)

```bash
npm run build   # compila Player e Host (Vite)
npm start       # sobe o servidor único (lê a porta de process.env.PORT)
```

### Render (com o Blueprint `render.yaml`)

1. Suba o código para um repositório no GitHub.
2. No painel do Render → **New → Blueprint** → conecte o repositório.
   O Render lê o `render.yaml` e cria o serviço com build/start prontos.
3. Ao terminar, o app fica em `https://<seu-servico>.onrender.com`
   (Player na raiz, Host em `/host`).

> Plano free do Render "dorme" após ~15 min sem uso; o 1º acesso demora
> ~50s para acordar. Abra a página antes de começar o quiz.

### Docker (Fly.io, VPS, etc.)

```bash
docker build -t karick .
docker run -p 3001:3001 -e PORT=3001 karick
```

## Persistência (biblioteca de quizzes + histórico)

O servidor usa **PostgreSQL** (via `pg`) para guardar os quizzes salvos e o
histórico de partidas. É **opcional**: sem `DATABASE_URL`, o app roda com um
repositório em memória (não persiste entre reinícios) — útil em dev.

- Tabelas (`quizzes`, `game_history`) são criadas automaticamente no boot.
- API REST em `/api`: `GET/POST/PUT/DELETE /api/quizzes`, `GET /api/history`.

### Configurar o banco (Supabase)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **Project Settings → Database → Connection string**, copie a string do
   **Session pooler** (compatível com IPv4, ideal para servidor persistente).
3. Substitua `[YOUR-PASSWORD]` pela senha do banco.
4. Defina como variável de ambiente `DATABASE_URL` (no Render: painel do serviço
   → **Environment**).

```bash
# Local, para testar contra o banco real:
DATABASE_URL="postgresql://...pooler.supabase.com:5432/postgres" npm start
```

## Importar quiz via JSON

No editor há **Importar JSON** (upload de arquivo ou colar texto). Ótimo para
gerar perguntas com uma IA. Formato canônico:

```json
{
  "title": "Nome do quiz",
  "questions": [
    { "text": "Enunciado?", "options": ["A", "B", "C", "D"], "correctIndex": 1, "timeLimitSec": 20, "points": 1000 }
  ]
}
```

- `correctIndex` é **0-based** (0 = primeira opção). Alternativa: `correctAnswer`
  com o **texto exato** de uma das opções.
- `timeLimitSec` e `points` são opcionais (padrão 20s / 1000).
- O botão **Copiar prompt para IA** no editor coloca um prompt pronto na área
  de transferência.

## Contas e login

O painel do apresentador (`/host`) exige **login** (e-mail + senha). Cada usuário
vê apenas a **própria** biblioteca de quizzes e histórico.

- Senhas com hash **scrypt** (nativo do Node); sessão via **cookie HttpOnly
  assinado (HMAC)**, `Secure` em produção, expira em 7 dias.
- Requer `DATABASE_URL` (tabela `users`) para persistir contas; sem banco, roda
  em memória (contas somem no restart).
- Defina **`SESSION_SECRET`** (o `render.yaml` gera automaticamente). Sem ele,
  um segredo efêmero é usado e as sessões caem a cada restart.
- Login/cadastro têm rate limit (10/min por IP) contra força-bruta.

> Quizzes criados antes do login ficam sem dono (`owner_id` nulo) e não
> aparecem para nenhuma conta.

## Escala horizontal (Redis)

Definir **`REDIS_URL`** ativa dois mecanismos:
1. **Adapter Redis do Socket.IO** — broadcast de eventos entre instâncias.
2. **Estado das salas no Redis** (`RedisRoomStore`) — com **escrita atômica**
   (WATCH/MULTI) para não perder atualizações concorrentes (ex.: dois jogadores
   respondendo em instâncias diferentes).

Sem `REDIS_URL`, o estado fica em memória (instância única). Se o Redis estiver
inacessível no boot, o app degrada e segue em memória — o boot nunca quebra.

> ⚠️ **Validar em staging antes de escalar.** Dois pontos precisam de teste com
> um Redis real + carga: (a) a semântica de WATCH/MULTI sob concorrência real
> (aqui foi validada só contra um mock); (b) os **timers de pergunta ainda são
> em processo** — se a instância que hospeda a sala cair, o timer daquela sala é
> perdido (resiliência de timers exigiria algo como BullMQ). Recomendado usar
> **sticky sessions** no balanceador.

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
