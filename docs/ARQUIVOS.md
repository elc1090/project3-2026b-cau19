# Guia dos arquivos do projeto

Para que serve cada arquivo do Dino Game (Projeto 3), o que tem dentro e como ele se conecta aos outros.
Os links levam direto para a linha citada.

---

## Mapa da pasta

```
project3-2026b-cau19/
│
├── server.js              ← BACKEND: liga o servidor e define todas as rotas da API
├── auth.js                ← BACKEND: cria e confere os tokens de login (o "porteiro")
├── database.js            ← BACKEND: conexão com o PostgreSQL
│
├── db/
│   ├── schema.sql         ← BANCO: cria as 4 tabelas e cadastra as skins
│   └── reset.sql          ← BANCO: apaga tudo (para recriar do zero)
│
├── public/                ← FRONTEND: tudo que o navegador baixa
│   ├── index.html         ← estrutura da página (abas, canvas, janela de login)
│   ├── style.css          ← aparência
│   ├── game.js            ← o jogo (física, desenho, sons, skins)
│   ├── auth.js            ← login/cadastro/logout no navegador + função api()
│   ├── app.js             ← abas, ranking, meus scores, medalhas, loja, fim de partida
│   └── *.png              ← sprites do dino e do cacto
│
├── tests/
│   └── api.test.js        ← TESTES: acessos permitidos e não permitidos
│
├── package.json           ← CONFIG: nome do projeto, dependências e comandos (npm start / npm test)
├── package-lock.json      ← CONFIG: versões exatas das dependências (gerado pelo npm)
├── docker-compose.yml     ← CONFIG: banco PostgreSQL local com Docker
├── .env.example           ← CONFIG: modelo das variáveis de ambiente (sem segredos)
├── .gitignore             ← CONFIG: o que NÃO vai para o GitHub
│
├── README.md              ← DOC: apresentação do projeto (entrega da disciplina)
├── ESTUDO.md              ← DOC: diário passo a passo, com conceitos e autoria
├── CLAUDE.md              ← DOC: regras para a IA neste projeto (governança)
├── .claude/skills/mentor/SKILL.md ← DOC: a skill "mentor" (como a IA deve me ensinar)
├── docs/ARQUIVOS.md       ← DOC: este guia
├── docs/projeto2/         ← DOC: documentação antiga do Projeto 2 (histórico)
└── demo.gif               ← DOC: GIF de demonstração usado no README

Ficam só no meu computador (não vão para o GitHub):
├── .env                   ← senhas e chaves de verdade
└── node_modules/          ← bibliotecas baixadas pelo npm install
```

---

## Como os arquivos conversam (exemplo: ver as medalhas)

```
1. Clico na aba "Medalhas"
      public/app.js  → showTab('medals') → loadMedals()
2. O app pede os dados ao servidor, com o token
      public/auth.js → api('/api/medals')  →  fetch com "Authorization: Bearer <token>"
3. O servidor recebe o pedido
      server.js      → app.get('/api/medals', requireAuth, ...)
4. Antes da rota, o porteiro confere o token
      auth.js        → requireAuth()  → sem token? responde 401 e PARA aqui
5. A rota consulta o banco
      server.js      → pool.query(MEDALS_SQL, ...)
      database.js    → o pool manda o SQL para o PostgreSQL
6. O banco responde com as linhas (tabelas criadas pelo db/schema.sql)
7. O servidor devolve JSON → o app.js monta a tela (ou o aviso 🔒 401)
```

---

## Backend (rodam no servidor, com Node.js)

### [`server.js`](../server.js) — o coração do backend
**Para que serve:** liga o servidor web (Express) e define **todas as rotas da API**: os "endereços"
que o navegador chama, como `/api/login` e `/api/scores`. Também entrega os arquivos da pasta
`public/` para o navegador.

**O que contém, na ordem:**
| Linha | Trecho | O que faz |
|---|---|---|
| [10](../server.js#L10) | `express.json()` | deixa o servidor entender o corpo dos pedidos em JSON |
| [13](../server.js#L13) | `express.static(...)` | entrega `index.html`, `game.js`, imagens etc. da pasta `public/` |
| [19](../server.js#L19) | `USERNAME_REGEX` | regra do nome de usuário: 3 a 20 letras, números ou `_` |
| [21](../server.js#L21) | `POST /api/register` | **cadastro**: valida, gera o hash da senha com bcrypt, salva e devolve um token |
| [52](../server.js#L52) | `POST /api/login` | **login**: compara a senha com o hash e devolve um token |
| [85](../server.js#L85) | `GET /api/scores` | ranking público: melhor score de cada jogador (top 10) |
| [102](../server.js#L102) | `GET /api/skins` | catálogo público de skins |
| [119](../server.js#L119) | `GET /api/me` 🔒 | dados do usuário logado (créditos, skin, recorde, skins compradas) |
| [142](../server.js#L142) | `POST /api/scores` 🔒 | salva um score e soma créditos, numa **transação** |
| [186](../server.js#L186) | `GET /api/me/scores` 🔒 | lista **só os meus** scores |
| [201](../server.js#L201) | `DELETE /api/scores/:id` 🔒 | apaga um score **só se for meu** (`AND user_id = $2`) |
| [224](../server.js#L224) | `MEDALS_SQL` | a consulta que calcula o pódio de cada mês/ano |
| [242](../server.js#L242) | `GET /api/medals` 🔒 | roda a consulta para mês e para ano |
| [254](../server.js#L254) | `POST /api/skins/:id/buy` 🔒 | compra skin: transação + `FOR UPDATE` + checa créditos |
| [301](../server.js#L301) | `PUT /api/me/skin` 🔒 | troca a skin em uso (só se for grátis ou comprada) |
| [323](../server.js#L323) | tratador de erros | responde JSON quando chega um JSON inválido |
| [331](../server.js#L331) | `app.listen(...)` | liga o servidor na porta (3001 no PC, a do Render na nuvem) |

🔒 = rota protegida: tem `requireAuth` antes, então exige login.

**Usa:** `database.js` (banco), `auth.js` (tokens), as bibliotecas `express` e `bcryptjs`.
**É usado por:** o `npm start` (que roda `node server.js`) e, indiretamente, pelo navegador.

---

### [`auth.js`](../auth.js) — o "porteiro"
**Para que serve:** tudo que envolve **token JWT** no servidor. Fica separado do `server.js` para
deixar claro onde mora a autenticação.

**O que contém:**
| Linha | Trecho | O que faz |
|---|---|---|
| [3](../auth.js#L3) | checagem do `JWT_SECRET` | se a chave secreta não estiver configurada, o servidor nem liga |
| [9](../auth.js#L9) | `createToken(user)` | cria o token com `id` e `username`, assinado, válido por 7 dias |
| [20](../auth.js#L20) | `requireAuth(req, res, next)` | **middleware**: lê o cabeçalho `Authorization: Bearer <token>`, confere assinatura e validade. Falhou → **401** e a rota não executa. Passou → coloca o usuário em `req.user` |
| [38](../auth.js#L38) | `module.exports` | deixa o `server.js` usar as duas funções |

**Usa:** a biblioteca `jsonwebtoken` e a variável `JWT_SECRET`.
**É usado por:** `server.js` (em todas as rotas 🔒).

---

### [`database.js`](../database.js) — a conexão com o banco
**Para que serve:** cria **uma** conexão compartilhada (pool) com o PostgreSQL, que o resto do código usa.

**O que contém:**
- `require('dotenv').config()`: lê o arquivo `.env` e coloca os valores em `process.env`
- checagem da `DATABASE_URL`: sem o endereço do banco, avisa e para
- `isLocal`: se a URL tem `localhost` (Docker), **sem SSL**; senão (Render), **com SSL**
- `new Pool(...)`: o grupo de conexões reaproveitadas
- `module.exports = pool`: quem fizer `require('./database')` recebe o pool

**Usa:** as bibliotecas `pg` e `dotenv` e a variável `DATABASE_URL`.
**É usado por:** `server.js`.

---

## Banco de dados

### [`db/schema.sql`](../db/schema.sql) — a estrutura do banco
**Para que serve:** cria as tabelas e cadastra as skins. Pode rodar várias vezes sem erro
(`if not exists` e `on conflict`).

**O que contém:**
| Tabela | Colunas principais | Regras que o banco garante |
|---|---|---|
| `skins` | `id`, `name`, `price`, `color` | preço ≥ 0 |
| *(insert das 7 skins)* | Clássico (grátis) até Arco-íris (2000) | `on conflict do update` atualiza preços/nomes |
| `users` | `username`, `password_hash`, `credits`, `selected_skin` | nome **único**, créditos ≥ 0, skin precisa existir |
| `scores` | `user_id`, `score`, `coins`, `created_at` | `user_id` precisa existir em `users`; apagou o usuário → apaga os scores (`cascade`) |
| índice `scores_user_id_idx` | — | deixa rápida a busca "scores do usuário X" |
| `user_skins` | `user_id`, `skin_id`, `purchased_at` | chave dupla: não dá para ter a mesma skin duas vezes |

**É usado por:** o Docker Compose (roda sozinho na primeira vez) e pelo comando `psql` que usei para criar as tabelas no Render.

### [`db/reset.sql`](../db/reset.sql) — apagar tudo
**Para que serve:** uma linha que **apaga as 4 tabelas** (`drop table ... cascade`). Usei uma vez, no
Render, quando a estrutura mudou. Depois dele, sempre rodar o `schema.sql`. ⚠️ Apaga os dados.

---

## Frontend (rodam no navegador)

### [`public/index.html`](../public/index.html) — a estrutura da página
**Para que serve:** o "esqueleto" da página. O JavaScript preenche e controla o que está aqui.

**O que contém:**
- `<head>`: título, ícone 🦖, fonte pixelada (Press Start 2P) e o `style.css`
- **cabeçalho**: título e área do usuário, com duas versões: `#logged-out` (botão Entrar) e
  `#logged-in` (nome, 💰 créditos, botão Sair). O `auth.js` mostra uma ou outra.
- **abas** (`<nav class="tabs">`): Jogar, Ranking, Meus scores 🔒, Medalhas 🔒, Loja
- **painéis** (`<section class="panel">`), um por aba:
  - `#tab-play`: o `<canvas>` do jogo, o botão de som e 3 telas sobrepostas (início, pausa, fim de jogo)
  - `#tab-ranking`, `#tab-my-scores`, `#tab-medals`, `#tab-shop`: contêineres vazios que o `app.js` preenche
- **`<dialog id="auth-dialog">`**: a janela de login/cadastro
- os 3 scripts no fim, **nessa ordem**: `game.js` → `auth.js` → `app.js`

### [`public/style.css`](../public/style.css) — a aparência
**Para que serve:** cores, espaçamentos e layout.

**O que contém:**
- **variáveis de cor** em `:root` (`--bg`, `--ink`, `--gold`…) e um **tema escuro** automático
  (`prefers-color-scheme: dark`)
- botões (`.btn`, `.btn-primary`, `.btn-danger`), abas (`.tab`), painéis (`.panel`)
- o jogo: canvas com proporção fixa (`aspect-ratio: 800 / 250`) e telas sobrepostas (`.overlay`)
- ranking, tabela de scores, cartões de medalha (`.podium`), aviso de acesso negado (`.locked`)
- loja em grade (`.skins-grid`, `.skin-card`) e a janela de login (`dialog`)
- ajustes para celular (`@media (max-width: 520px)`)

### [`public/game.js`](../public/game.js) — o jogo
**Para que serve:** toda a lógica e o desenho do jogo no `<canvas>`. Não sabe nada de login nem de
banco: quando a partida acaba, só avisa o `app.js`.

**O que contém, por partes:**
| Linha | Parte | O que faz |
|---|---|---|
| [5](../public/game.js#L5) | comentário do `dt` | explica por que tudo é "por segundo" (independe do monitor) |
| [19](../public/game.js#L19)–[54](../public/game.js#L54) | **constantes** | tamanho do jogo, gravidade, força do pulo, velocidades, cores de dia e de noite |
| [57](../public/game.js#L57) | `loadImage` | carrega os PNGs |
| [78](../public/game.js#L78) | `tintImage` | **pinta** um sprite com a cor da skin (e deixa o fundo branco transparente) |
| [112](../public/game.js#L112) | `buildSkin` | monta os sprites de uma skin (Clássico, Fantasma e Arco-íris são especiais) |
| [139](../public/game.js#L139) / [145](../public/game.js#L145) | `setSkin` / `drawSkinPreview` | usados pelo `app.js`: trocar a skin no jogo / desenhar a prévia na loja |
| [165](../public/game.js#L165) | **estado** | `state` (idle, playing, paused, gameover), dino, obstáculos, moedas, score... |
| [201](../public/game.js#L201) | `resetGame` | zera tudo para uma partida nova |
| [228](../public/game.js#L228)–[315](../public/game.js#L315) | **controles** | pular, soltar, pausar; teclado, toque e pausa automática ao trocar de aba |
| [321](../public/game.js#L321) | `spawnObstacle` | sorteia o próximo obstáculo (cacto, grupo, pássaro) e às vezes uma moeda |
| [412](../public/game.js#L412) | `rectsOverlap` | colisão entre retângulos (AABB) |
| [433](../public/game.js#L433) | **`update(dt)`** | o "cérebro": velocidade, pontos, física do pulo (`s = v·t + ½·a·t²`), move tudo, coleta moedas, testa colisão |
| [517](../public/game.js#L517) | `updateEffects` | dia/noite, partículas, tremida, textos "+1" |
| [540](../public/game.js#L540) | `die` | fim de jogo: treme, toca o som e chama `handleGameOver` do `app.js` |
| [571](../public/game.js#L571) | **`draw()`** | desenha o quadro: céu, estrelas, nuvens, chão, moedas, obstáculos, dino, partículas e placar |
| [742](../public/game.js#L742)–[797](../public/game.js#L797) | **sons** | bipes gerados na hora (Web Audio API), botão 🔊 / tecla M |
| [805](../public/game.js#L805) | **`frame(now)`** | o **laço principal**: calcula o `dt`, chama `update` e `draw` e pede o próximo quadro |

### [`public/auth.js`](../public/auth.js) — login no navegador
**Para que serve:** guardar o token, fazer login/cadastro/logout e **mandar o token em todo pedido**.

**O que contém:**
| Linha | Trecho | O que faz |
|---|---|---|
| [9](../public/auth.js#L9) | `TOKEN_KEY`, `currentUser` | nome da "gaveta" no localStorage e os dados do usuário logado |
| [12](../public/auth.js#L12)–[39](../public/auth.js#L39) | `getToken`, `saveToken`, `clearToken` | ler, guardar e apagar o token (com `try/catch` para navegadores que bloqueiam) |
| [43](../public/auth.js#L43) | **`api(path, ...)`** | **todo pedido ao servidor passa aqui**: põe o cabeçalho `Authorization`, converte a resposta e, se der 401 com token, sai da conta |
| [69](../public/auth.js#L69) | `refreshUser` | busca `GET /api/me` e atualiza a tela |
| [83](../public/auth.js#L83) | `logout` | **apaga o token** = sai da conta |
| [96](../public/auth.js#L96) | `updateUserArea` | mostra "Entrar" ou "nome + créditos + Sair" |
| [121](../public/auth.js#L121)–[145](../public/auth.js#L145) | janela de login | alterna entre Entrar e Cadastrar, abre a janela e envia o formulário para `/api/login` ou `/api/register` |

### [`public/app.js`](../public/app.js) — as telas da aplicação
**Para que serve:** liga tudo: abas, ranking, meus scores, medalhas, loja e o que acontece no fim da
partida. **Não esconde as abas protegidas**: sempre pede ao servidor e mostra o 401 se ele negar.

**O que contém:**
| Linha | Parte | O que faz |
|---|---|---|
| [10](../public/app.js#L10) | `escapeHtml` | impede que um texto vindo do servidor vire código (proteção contra XSS) |
| [35](../public/app.js#L35) | `lockedHtml` | o aviso 🔒 **"Acesso negado pelo servidor HTTP 401"** |
| [60](../public/app.js#L60) | `showTab` | troca de aba e carrega os dados dela |
| [79](../public/app.js#L79) | `loadRanking` | ranking público |
| [112](../public/app.js#L112) / [150](../public/app.js#L150) | `loadMyScores` + clique em Apagar | tabela dos meus scores e o `DELETE` |
| [170](../public/app.js#L170)–[223](../public/app.js#L223) | medalhas | nomes dos meses, agrupamento por período, pódios e "minhas medalhas" |
| [279](../public/app.js#L279) / [325](../public/app.js#L325) | `loadShop` + cliques | cartões das skins e os botões Comprar / Usar |
| [364](../public/app.js#L364) | **`handleGameOver`** | chamado pelo `game.js` no fim da partida: logado → salva; visitante → guarda a partida e oferece login |
| [382](../public/app.js#L382) | `saveResult` | `POST /api/scores` e mostra "+N créditos" |
| [407](../public/app.js#L407) | `onLoggedIn` | depois do login, salva a partida que estava esperando |
| [418](../public/app.js#L418) | `onUserChanged` | ao entrar/sair: troca a skin do jogo, o recorde e recarrega a aba aberta |
| [428](../public/app.js#L428) | `init` | ao abrir a página: carrega as skins e o usuário |

### Imagens (`public/*.png`)
| Arquivo | O que é |
|---|---|
| `dino1.png`, `dino2.png` | dino correndo (2 quadros que se alternam) |
| `dinoparado.png` | dino parado / no ar. **Tinha fundo branco** em vez de transparente, e o `tintImage` corrige isso |
| `cacto.png` | cacto (pintado de claro à noite) |

---

## Testes

### [`tests/api.test.js`](../tests/api.test.js) — acessos permitidos e não permitidos
**Para que serve:** prova automaticamente que a segurança funciona. Chama a API como um programa
qualquer chamaria (sem o site), criando dois usuários de teste: Alice e Bob.

**O que contém:**
- `api(path, ...)`: função para fazer pedidos (igual à do navegador, mas no Node)
- **16 testes**: cadastro, nome repetido (409), senha curta (400), login certo e errado (401),
  **7 rotas sem token (401)**, **token falsificado (401)**, salvar score, moedas impossíveis (400),
  **Bob não vê nem apaga o score da Alice (404)**, medalhas, compra sem créditos (400), skin não
  comprada (403), compra e equipar, apagar o próprio score (204)

**Como rodar:** `npm test` (servidor ligado). Contra o site publicado:
`$env:BASE_URL="https://dino-game-d3y2.onrender.com"; npm test`

---

## Configuração

### [`package.json`](../package.json) — a "ficha" do projeto
- **nome, descrição, autor**
- **`scripts`**: `npm start` → `node server.js` · `npm test` → `node --test tests/`
- **`dependencies`**, as 5 bibliotecas:
  | Biblioteca | Para quê |
  |---|---|
  | `express` | servidor web e rotas |
  | `pg` | conversar com o PostgreSQL |
  | `bcryptjs` | hash de senhas |
  | `jsonwebtoken` | criar e conferir tokens |
  | `dotenv` | ler o `.env` |

### `package-lock.json` — versões exatas
Gerado pelo `npm install`. Guarda a versão **exata** de cada biblioteca (e das bibliotecas delas), para
o Render instalar exatamente o mesmo que eu. **Não se edita à mão.**

### [`docker-compose.yml`](../docker-compose.yml) — o banco local
Descreve o container do PostgreSQL: imagem `postgres:16`, nome `dino-postgres`, usuário/senha/banco,
porta `5432`, um **volume** (`dino-data`) para os dados não sumirem e o `schema.sql` montado em
`/docker-entrypoint-initdb.d/` (roda sozinho na primeira vez).
Uso: `docker compose up -d` (liga) · `docker compose down` (desliga).

### [`.env.example`](../.env.example) — modelo das variáveis
Mostra **quais** variáveis o projeto precisa, **sem os valores secretos**:
| Variável | Para quê |
|---|---|
| `DATABASE_URL` | endereço do banco (`postgres://usuario:senha@maquina:porta/banco`) |
| `PORT` | porta do servidor (3001 no meu PC; o Render define a dele) |
| `JWT_SECRET` | chave que assina os tokens |

Quem baixar o projeto copia para `.env` e preenche.

### `.env` — os valores de verdade (não vai para o GitHub)
Igual ao `.env.example`, mas com os valores reais. No Render, essas variáveis ficam no painel
(*Environment*), não em arquivo.

### [`.gitignore`](../.gitignore) — o que o Git ignora
`node_modules/` (bibliotecas, que o npm baixa de novo), `.env` (segredos) e `database.db` (sobra do
SQLite do Projeto 2).

---

## Documentação e governança

| Arquivo | Para que serve |
|---|---|
| [`README.md`](../README.md) | apresentação oficial do projeto (template da disciplina): GIF, link, proposta, processo, trechos de código, tecnologias, autenticação/autorização, referências |
| [`ESTUDO.md`](../ESTUDO.md) | **diário passo a passo** (Etapas 0 a 10): o que foi feito, por quê, conceitos, comandos, problemas e **autoria** (✍️ eu / 📓 IA). Tem roteiro de apresentação e perguntas no fim |
| [`CLAUDE.md`](../CLAUDE.md) | regras que a IA lê automaticamente neste projeto: eu sou iniciante, a IA explica antes, eu decido, tudo é registrado no ESTUDO.md |
| [`.claude/skills/mentor/SKILL.md`](../.claude/skills/mentor/SKILL.md) | a skill "mentor": o passo a passo que a IA segue (explicar → eu escolho "ok" ou "tutorial" → revisão), os limites de complexidade e o formato do registro |
| [`docs/ARQUIVOS.md`](./ARQUIVOS.md) | este guia |
| [`docs/projeto2/TUTORIAL.md`](./projeto2/TUTORIAL.md) | tutorial do Projeto 2 (SQLite → Supabase → Vercel), guardado como histórico |
| [`docs/projeto2/DEBUGGING.md`](./projeto2/DEBUGGING.md) | o debugging do *"Cannot GET /"* na Vercel (Projeto 2) |
| `demo.gif` | animação de demonstração usada no README |

---

## Resumo: "se eu quiser mudar X, mexo em..."

| Quero mudar... | Arquivo |
|---|---|
| uma regra de segurança ou uma rota da API | `server.js` (e `auth.js` se for sobre token) |
| uma tabela ou o preço de uma skin | `db/schema.sql` (e rodar de novo no banco) |
| a física ou a dificuldade do jogo | constantes no topo do `public/game.js` |
| textos ou o comportamento das abas | `public/app.js` |
| o login/logout no navegador | `public/auth.js` |
| a estrutura da página | `public/index.html` |
| cores e layout | `public/style.css` |
| uma senha, porta ou chave | `.env` (no PC) ou o painel do Render |
| adicionar uma biblioteca | `npm install nome` (atualiza `package.json` e `package-lock.json`) |
