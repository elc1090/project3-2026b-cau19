# Tutorial: Dino Game com persistência de dados

Este tutorial explica, passo a passo, como o projeto foi construído. A ideia é que você consiga
reproduzir cada etapa entendendo o "porquê", não só copiar o código pronto. Use isso como base para
escrever a seção **Processo** do seu README com suas próprias palavras.

Stack: **Node.js + Express** no backend, **HTML/CSS/JavaScript puro com Canvas** no frontend, e
**Supabase (PostgreSQL)** como banco de dados. O banco começou como **SQLite** local (fase 1, arquivo
`database.db`) só pra aprender persistência sem depender de internet/conta em serviço nenhum, e depois
foi trocado pelo Supabase de verdade (fase 2). O código de SQLite não existe mais no projeto — os
Passos 1 a 7 abaixo ficam registrados como histórico de como a fase 1 foi construída.

---

## Fase 1 — Projeto local

### Passo 1: Preparar o projeto Node.js

1. Crie a pasta do projeto (ou use a que já tem o Git iniciado) e rode:
   ```
   npm init -y
   ```
   Isso cria o `package.json`, que guarda as dependências e os scripts do projeto.

2. Instale as bibliotecas que vamos usar:
   ```
   npm install express better-sqlite3
   ```
   - `express`: framework simples para criar um servidor web e uma API.
   - `better-sqlite3`: biblioteca para ler/escrever num banco SQLite, que é só **um arquivo** no disco
     (`database.db`). Isso é ótimo para aprender: não precisa instalar um banco de dados separado,
     não tem servidor de banco rodando, é só um arquivo.

3. Crie um `.gitignore` para não subir `node_modules/` e o arquivo do banco (`database.db`) para o Git.

### Passo 2: Criar a conexão com o banco (`database.js`)

O banco precisa de uma tabela para guardar os scores do ranking: nome do jogador, pontuação e data.

```js
const Database = require('better-sqlite3');
const db = new Database('database.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;
```

`CREATE TABLE IF NOT EXISTS` garante que, ao rodar o servidor pela primeira vez, a tabela é criada
automaticamente — você não precisa criar o banco manualmente.

### Passo 3: Criar o servidor Express (`server.js`)

O servidor tem duas responsabilidades:
1. Servir os arquivos estáticos do jogo (pasta `public/`: HTML, CSS, JS).
2. Expor uma API para salvar e consultar o ranking.

Duas rotas bastam:
- `GET /api/scores` → devolve os 10 melhores scores.
- `POST /api/scores` → recebe `{ name, score }` e salva no banco.

Veja `server.js` no projeto. Repare que sempre validamos o que chega do cliente (nome não vazio, score
é número) antes de gravar — nunca confie em dados vindos do frontend.

Para rodar: `npm start` (ou `node server.js`) e abrir `http://localhost:3000`.

### Passo 4: Montar o HTML base (`public/index.html`)

Estrutura mínima: um `<canvas>` onde o jogo é desenhado, uma tela inicial, uma tela de "fim de jogo"
com formulário para digitar o nome, e uma lista de ranking.

### Passo 5: O jogo em si (`public/game.js`)

Esse é o coração do projeto. Um jogo em Canvas é basicamente um **loop** que roda a cada frame:

```js
function loop() {
  update(); // atualiza posições, física, colisões
  draw();   // desenha tudo de novo na tela
  requestAnimationFrame(loop); // agenda o próximo frame (~60x por segundo)
}
```

Os conceitos principais:

- **Física do pulo (gravidade)**: o dino tem uma `velocityY`. A cada frame, somamos a gravidade a essa
  velocidade e somamos a velocidade à posição `y`. Isso cria uma curva de pulo natural, sem precisar de
  nenhuma fórmula complicada — é só "a cada frame, cai um pouco mais rápido".
- **Obstáculos**: um array de retângulos que nascem do lado direito da tela e se movem para a
  esquerda. A cada frame, filtramos os que já saíram da tela para não acumular memória.
- **Progressão de dificuldade**: a velocidade dos obstáculos (`obstacleSpeed`) e o intervalo entre eles
  (`spawnInterval`) não são fixos. Um fator `ramp` cresce de 0 a 1 ao longo de `SPEED_RAMP_FRAMES`
  frames (~30s) e é usado para interpolar entre um valor inicial (mais lento, mais espaçado) e um teto
  máximo (mais rápido, mais frequente). Isso evita começar difícil demais e também evita que o jogo
  fique impossível depois de muito tempo (por isso o `Math.min(..., 1)` no `ramp`).
- **Colisão**: comparação de retângulos (AABB - *Axis-Aligned Bounding Box*). Dois retângulos se
  sobrepõem se, ao mesmo tempo, há sobreposição no eixo X e no eixo Y. É a forma mais simples de detectar
  colisão em jogos 2D.
- **Score**: cresce com o tempo sobrevivido (contamos frames e convertemos para um número menor).

### Passo 6: Salvando o score e mostrando o ranking

Quando o jogo termina (`endGame()`), mostramos a tela de game over com o score final e um formulário.
Ao enviar o formulário, fazemos um `fetch` para `POST /api/scores`. Depois, recarregamos o ranking com
outro `fetch` para `GET /api/scores` e atualizamos a lista na tela.

Esse é o requisito central do projeto: **persistência de dados através de uma API**, sem precisar de
login — só o nome digitado ao final da partida.

### Passo 7: Testar localmente

1. `npm start`
2. Abra `http://localhost:3000`
3. Jogue, perca, salve um score, veja se ele aparece no ranking.
4. Pare o servidor (Ctrl+C) e rode de novo — o `database.db` continua no disco, então os scores
   persistem entre execuções. Esse é o comportamento que comprova que a persistência funciona antes
   mesmo de existir um banco "de verdade" na nuvem.

---

## Fase 2 — Banco de dados real (Supabase)

> ⚠️ **Status: banco real integrado e testado localmente. Deploy público ainda não feito.** O servidor
> já lê e grava no Supabase quando você roda `npm start` na sua máquina. Falta só publicar o projeto na
> internet (Vercel/Render) e atualizar a seção **Acesso** do README com a URL.

### Passo 8: Criar o projeto no Supabase

Em [supabase.com/dashboard](https://supabase.com/dashboard), criar um novo projeto (é um banco
PostgreSQL gerenciado, gratuito no plano free). Guarde a senha do banco em local seguro — ela não é a
mesma coisa que as chaves de API que usamos no `.env`.

### Passo 9: Criar a tabela via migration SQL (`supabase/migration.sql`)

Em vez de criar a tabela clicando manualmente no Table Editor, escrevemos o SQL num arquivo versionado
no Git (`supabase/migration.sql`) e rodamos ele no **SQL Editor** do painel do Supabase. Isso deixa
documentado e repetível como o banco foi criado — se precisar recriar o projeto do zero, é só rodar o
arquivo de novo.

```sql
create table if not exists scores (
  id bigint generated always as identity primary key,
  name text not null,
  score integer not null,
  created_at timestamptz not null default now()
);

alter table scores enable row level security;

create policy "Qualquer pessoa pode ler o ranking"
  on scores for select
  to anon
  using (true);

create policy "Qualquer pessoa pode inserir um score"
  on scores for insert
  to anon
  with check (true);
```

Dois pontos importantes de segurança:
- **Row Level Security (RLS) ligado**: por padrão, com RLS ativo e sem nenhuma policy, *ninguém* acessa
  a tabela — nem para ler. As policies acima são a exceção explícita: liberam `select` e `insert` para
  quem usa a chave pública (`anon`).
- **Sem policy de `update`/`delete`**: mesmo alguém com a chave pública em mãos (ela fica visível no
  tráfego de rede do navegador, então não é segredo) não consegue alterar ou apagar scores já salvos.
  Isso é diferente de simplesmente desligar o RLS, que liberaria tudo.

### Passo 10: Pegar as chaves e configurar o `.env`

No painel do Supabase: **Project Settings → API** (pode aparecer como "Data API" / "API Keys",
dependendo da versão do painel). De lá, copiar:
- **Project URL** (algo como `https://xxxxxxxx.supabase.co`)
- A chave **pública** — hoje o Supabase chama de `anon` / `public` ou `publishable` (prefixo
  `sb_publishable_...`). **Nunca** usar a chave `service_role` / `secret` no `.env` de um projeto que
  fica rodando com policies de RLS liberadas por engano; a `service_role` ignora RLS completamente.

Essas duas informações vão no arquivo `.env` (nunca no código nem no README — por isso ele está no
`.gitignore`; use `.env.example` como referência de quais variáveis preencher):

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
```

### Passo 11: Trocar a conexão do banco (`database.js` e `server.js`)

`database.js` deixou de abrir um arquivo SQLite e passou a criar um cliente do Supabase, lendo a URL e
a chave do `.env` (via `dotenv`):

```js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = supabase;
```

A diferença mais importante no `server.js`: `better-sqlite3` era **síncrono** (`db.prepare(...).all()`
retornava na hora), enquanto `supabase-js` fala com o banco pela internet, então é **assíncrono** — toda
chamada usa `await` e retorna `{ data, error }`:

```js
app.get('/api/scores', async (req, res) => {
  const { data, error } = await supabase
    .from('scores')
    .select('name, score, created_at')
    .order('score', { ascending: false })
    .limit(10);

  if (error) return res.status(500).json({ error: 'Erro ao buscar o ranking' });
  res.json(data);
});
```

A lógica (buscar top 10, inserir com validação) continua a mesma de antes — só mudou *como* o servidor
conversa com o banco.

### Passo 12: Testar localmente contra o Supabase real

1. `npm start` — se faltar `SUPABASE_URL`/`SUPABASE_KEY` no `.env`, o servidor lança um erro explicando
   o que falta, em vez de falhar silenciosamente.
2. Jogue uma partida, salve um score.
3. Confira no painel do Supabase, em **Table Editor → scores**, que a linha apareceu lá — não é mais um
   arquivo local, é o banco na nuvem.

---

## Fase 3 — Deploy na Vercel

> ✅ **Status: no ar.** https://project2-2026b-cau19.vercel.app — testado (`/`, `/style.css`, `/game.js`,
> `/api/scores` todos respondendo certo, gravando e lendo do Supabase real).

O que ficou assim no código, depois de algumas tentativas que não funcionaram:

- `server.js` faz `module.exports = app` além de `app.listen(...)`. Necessário porque na Vercel o
  servidor não roda com `node server.js` continuamente — a Vercel importa o `app` exportado e o invoca a
  cada requisição. Por isso `app.listen(...)` fica dentro de `if (!process.env.VERCEL) { ... }`:
  localmente (`npm start`) sobe um servidor normal; na Vercel, essa parte é ignorada.
- `api/[...path].js` só reexporta esse mesmo app (`module.exports = require('../server.js')`). Qualquer
  arquivo dentro de `api/` vira função serverless automaticamente — isso é o mecanismo mais básico e
  confiável da Vercel, funciona independente de qualquer detecção de framework. O `[...path]` (colchetes)
  é a sintaxe de "catch-all": essa única função responde por qualquer sub-caminho de `/api/*`
  (`/api/scores`, etc.), recebendo o caminho original da requisição sem reescrita nenhuma.
- Dentro do `server.js`, `express.static(path.join(__dirname, 'public'))` usa caminho **absoluto**
  (baseado em `__dirname`), não `express.static('public')` (relativo). Isso importa porque, no ambiente
  serverless da Vercel, o diretório de trabalho (`process.cwd()`) não é garantidamente a raiz do projeto
  — com caminho relativo, o Express simplesmente não achava a pasta `public/` e toda rota que não fosse
  `/api/*` caía no 404 padrão do Express (`Cannot GET /`).
- **Nenhum `vercel.json`.** Nenhuma das opções acima precisa de configuração manual de rotas.

> Histórico do que foi tentado e não funcionou, só pra registro (evita repetir o erro — versão completa,
> com prints do diagnóstico via `curl`, em [DEBUGGING.md](./DEBUGGING.md)):
> 1. Uma função `@vercel/node` "crua" com `vercel.json` mandando tudo pra ela: o build só empacota o que
>    é importado via `require`, então a pasta `public/` (só referenciada em runtime) ficava de fora —
>    `Cannot GET /`.
> 2. Separar `api/` (função) de `public/` (estático) com `rewrites` manuais no `vercel.json`: a Vercel
>    avisou que, no que ela chama de "backend framework projects", rewrite passou a rotear usando o
>    **destino** reescrito — meu rewrite `/api/:path*` → `/api` fazia o Express receber só o caminho
>    `/api`, nunca `/api/scores`.
> 3. Remover o `vercel.json` inteiro e confiar em detecção automática de framework: sem pasta `api/`
>    nenhuma, a Vercel não criou função nenhuma — o site virou puramente estático (por isso nem existia
>    a opção "Framework Preset" nas configurações). Tudo 404 de novo.
> 4. Trazer `api/[...path].js` de volta (sem `vercel.json`): a função passou a existir e `/api/scores`
>    funcionou, mas `/` continuava dando `Cannot GET /` — só que agora era um 404 do **Express**, não da
>    Vercel (dava pra ver pelo header `X-Powered-By: Express` presente até no erro). Isso apontou pro
>    problema real: caminho relativo no `express.static`.
> 5. Trocar pra `path.join(__dirname, 'public')` resolveu — esse é o que ficou no código final.

Passos que foram feitos no painel/CLI da Vercel:

1. Importar o repositório do GitHub em [vercel.com/new](https://vercel.com/new) (ou `vercel link` pela
   CLI, que faz a mesma coisa).
2. Configurar as variáveis de ambiente `SUPABASE_URL` e `SUPABASE_KEY` (Project Settings →
   Environment Variables), com os mesmos valores do `.env` local — nunca commitadas no Git.
3. Cada push na branch `main` dispara um novo deploy automaticamente.
