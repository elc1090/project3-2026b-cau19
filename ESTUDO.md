# Diário de estudo: Projeto 3 (Dino Game com usuários)

Registro de cada passo do desenvolvimento: o que foi feito, por quê, os conceitos envolvidos e como
testar. Serve para estudar depois e apresentar em sala.

**Legenda de autoria:** 📓 ajuda maior da IA (eu aprovei antes e estudei pelo caderno) · ✍️ eu escrevi (com tutorial e revisão da IA)

---

## Etapa 0: Preparação

### Etapa 0, passo 1: copiar o Projeto 2 📓

**O que:** copiei todos os arquivos do `project2-2026b-cau19` para este repositório, **menos a pasta
`.git`**.

**Por que:** o Projeto 3 é uma atualização do Projeto 2. A pasta `.git` guarda o histórico e o
endereço do repositório no GitHub. Se ela fosse copiada, este projeto passaria a "ser" o Projeto 2.
Sem ela, o Projeto 3 mantém o próprio histórico.

**Observação:** o `.gitignore` ignora todos os arquivos que começam com `.env`. Ele foi feito para
proteger o `.env`, que tem senhas, mas acaba ignorando também o `.env.example`, que não tem nada secreto.
*(Corrigido na Etapa 1, passo 5.)*

### Etapa 0, passo 2: governança com IA 📓

**O que:** criei o [CLAUDE.md](CLAUDE.md) e a skill [mentor](.claude/skills/mentor/SKILL.md).

**Por que:** sou iniciante em backend e preciso entender e conseguir explicar tudo. Esses arquivos
definem como a IA trabalha comigo:

1. A IA **explica** o que vai fazer, com um exemplo testável.
2. Eu decido: **"ok"** (a IA escreve) ou **"tutorial"** (eu escrevo seguindo um passo a passo e
   depois peço revisão).
3. Cada passo concluído é registrado aqui no `ESTUDO.md`.

**Conceito: skill.** É um arquivo de instruções que a IA lê para saber *como* se comportar numa
tarefa. O `CLAUDE.md` é lido automaticamente em toda conversa neste projeto.

---

## Etapa 1: Trocar Supabase por PostgreSQL

**Objetivo da etapa:** o banco deixa de ser o Supabase e passa a ser um PostgreSQL comum, primeiro na
minha máquina (com Docker) e depois no Render. A API do jogo (`/api/scores`) continua igual.

### Etapa 1, passo 1: subir o PostgreSQL com Docker 📓

**O que:** rodei um banco PostgreSQL dentro de um **container** Docker.

**Por que:** a proposta pede PostgreSQL no Render. Testar localmente primeiro é de graça, rápido e,
se der errado, basta apagar o container e começar de novo.

**Conceito: container.** Uma "caixinha" com o Postgres já instalado e configurado. O Docker liga e
desliga essa caixinha. Meu servidor Node conversa com ela pela porta `5432`, como se o Postgres
estivesse instalado no meu computador.

**Comando:**
```bash
docker run --name dino-postgres -e POSTGRES_USER=dino -e POSTGRES_PASSWORD=dino123 -e POSTGRES_DB=dinogame -p 5432:5432 -d postgres:16
```
| Parte | Significado |
|---|---|
| `docker run` | cria e liga um container novo |
| `--name dino-postgres` | dá um nome ao container (para usar depois) |
| `-e POSTGRES_USER=dino` | variável de ambiente: o usuário do banco |
| `-e POSTGRES_PASSWORD=dino123` | a senha desse usuário |
| `-e POSTGRES_DB=dinogame` | o nome do banco criado automaticamente |
| `-p 5432:5432` | liga a porta 5432 do meu PC à porta 5432 do container |
| `-d` | roda em segundo plano (não trava o terminal) |
| `postgres:16` | a **imagem** (o "molde" da caixinha), versão 16 |

**Como testar:**
```bash
docker ps                                   # deve listar dino-postgres com status "Up"
docker exec -it dino-postgres psql -U dino -d dinogame -c "SELECT 'funcionou!' AS teste;"
```
Resultado esperado: uma tabelinha com `funcionou!`.

**Problema encontrado:** `failed to connect to the docker API`. O Docker estava instalado, mas o
**Docker Desktop estava fechado**, então o "motor" que roda os containers estava desligado.
**Solução:** abrir o Docker Desktop antes de trabalhar.

**Comandos do dia a dia:**
- `docker start dino-postgres`: religa o container (os dados continuam lá)
- `docker stop dino-postgres`: desliga
- `docker ps`: lista os containers ligados

**Pergunta para revisar:** *Se eu desligar o computador, perco os dados do banco?*
Não. Os dados ficam guardados no container. Basta abrir o Docker Desktop e dar `docker start dino-postgres`.
Os dados só se perdem se o container for apagado (`docker rm`).

### Etapa 1, passo 2: criar a tabela `scores` ✍️

**O que:** criei o arquivo [db/schema.sql](db/schema.sql) com a tabela do ranking e rodei esse arquivo no banco.

**Por que:** o banco novo estava vazio. O jogo precisa de uma tabela para salvar e ler os scores.

**Código:**
```sql
create table if not exists scores (
  id bigint generated always as identity primary key,
  name text not null,
  score integer not null,
  created_at timestamptz not null default now()
);
```
| Parte | Significado |
|---|---|
| `if not exists` | só cria se a tabela ainda não existir (rodar duas vezes não dá erro) |
| `bigint` | número inteiro grande |
| `generated always as identity` | o banco numera sozinho: 1, 2, 3… |
| `primary key` | identificador único de cada linha |
| `not null` | o campo é obrigatório |
| `timestamptz` | data e hora com fuso horário |
| `default now()` | se ninguém informar a data, usa o momento atual |

**Conceito: por que tiramos o RLS (Row Level Security).** No Projeto 2, o navegador falava *direto*
com o Supabase usando uma chave pública. As *policies* de RLS limitavam o que essa chave podia fazer.
Agora **só o servidor Express fala com o banco**, e o navegador nunca recebe a senha. Quem decide o
que é permitido passa a ser o código das rotas no `server.js`.

**Como rodar e testar (PowerShell):**
```powershell
Get-Content db/schema.sql | docker exec -i dino-postgres psql -U dino -d dinogame
docker exec dino-postgres psql -U dino -d dinogame -c "\d scores"
docker exec dino-postgres psql -U dino -d dinogame -c "INSERT INTO scores (name, score) VALUES ('teste', 42);"
docker exec dino-postgres psql -U dino -d dinogame -c "SELECT * FROM scores;"
```
Resultados esperados: `CREATE TABLE` → as 4 colunas → `INSERT 0 1` → a linha `1 | teste | 42 | <data>`.

**Problema encontrado:** no PowerShell, `psql ... < db/schema.sql` deu o erro *"O operador '<' está
reservado para uso futuro"*. O `<` funciona no Bash, mas não no PowerShell.
**Solução:** `Get-Content arquivo | comando`. O `Get-Content` lê o arquivo e o `|` (pipe) entrega o
conteúdo ao comando seguinte.

**Detalhes que apareceram:**
- `scores_pkey`: índice criado **automaticamente** pelo `primary key`, para buscas rápidas por `id`.
- `INSERT 0 1`: 1 linha inserida (o `0` é um valor antigo do Postgres e pode ser ignorado).
- `12:45:58+00`: o `+00` quer dizer **UTC**, o horário padrão mundial. No Brasil (UTC−3) eram 09:45. O banco
  guarda tudo em UTC. Isso vai importar nas medalhas mensais.

**Pergunta para revisar:** *Se eu inserir outro score, qual `id` ele recebe?*
`2`, porque o `identity` continua a contagem sozinho. Mesmo se a linha 1 for apagada, o próximo
continua sendo 2, já que os números não são reaproveitados.

### Etapa 1, passo 3: conectar o Node ao Postgres 📓

**O que:** troquei a biblioteca `@supabase/supabase-js` pela `pg` e reescrevi o [database.js](database.js).

**Por que:** o servidor precisa de um "cliente" que saiba mandar SQL para o *nosso* Postgres. O
cliente do Supabase só funciona com o Supabase.

**Conceitos:**
- **Connection string**: o endereço completo do banco num texto só.
  `postgres://dino:dino123@localhost:5432/dinogame` →
  `postgres://` **usuário** `:` **senha** `@` **máquina** `:` **porta** `/` **banco**.
  Ela fica no `.env`, porque tem senha, e o `.env` nunca vai para o GitHub (está no `.gitignore`).
- **Pool**: um grupo de conexões com o banco que ficam abertas e são reaproveitadas, como deixar
  algumas linhas telefônicas sempre ligadas em vez de discar de novo a cada pergunta. No código
  basta `pool.query('SQL aqui')`.
- **dotenv**: biblioteca que lê o arquivo `.env` e coloca os valores em `process.env`.

**Arquivos:**
- `package.json`: `npm uninstall @supabase/supabase-js` e `npm install pg`
- [.env.example](.env.example): modelo com `DATABASE_URL` (sem segredo real)
- `.env`: cópia do exemplo (fica só na minha máquina)
- [database.js](database.js): reescrito

**Código:**
```js
require('dotenv').config();          // lê o .env e preenche process.env
const { Pool } = require('pg');      // pega a classe Pool da biblioteca pg

if (!process.env.DATABASE_URL) {     // sem endereço do banco, nem adianta continuar
  throw new Error('DATABASE_URL nao definida. Copie .env.example para .env e preencha.');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = pool;               // outros arquivos usam: require('./database')
```

**Como testar** (sem subir o servidor):
```powershell
node -e "require('./database').query('SELECT * FROM scores').then(r => { console.log(r.rows); process.exit(); })"
```
Resultado esperado: o score de teste, agora lido **pelo Node**:
```
[ { id: '1', name: 'teste', score: 42, created_at: 2026-10-19T12:45:58.304Z } ]
```
- `r.rows` é um array com uma linha por registro, cada uma como objeto JS.
- O `id` vem como texto (`'1'`) porque é `bigint`, um número que pode ser grande demais para o
  JavaScript guardar com precisão. Para nós não faz diferença.

**Situação:** o `server.js` ainda usa `supabase.from(...)`, então o servidor não sobe ainda.
Isso é o próximo passo.

**Pergunta para revisar:** *Por que a senha do banco fica no `.env` e não no `database.js`?*
O `database.js` vai para o GitHub e qualquer um poderia ver a senha. O `.env` está no `.gitignore`
e fica só na máquina (ou nas configurações do Render, no deploy).

### Etapa 1, passo 4: adaptar as rotas do `server.js` 📓

**O que:** reescrevi as duas rotas do [server.js](server.js) (`GET` e `POST /api/scores`) para usar SQL
com `pool.query`, no lugar de `supabase.from(...)`. Também configurei a porta do servidor para `3001`.

**Por que:** era o último pedaço que dependia do Supabase. Agora o jogo funciona com o nosso Postgres.
O frontend ([game.js](public/game.js)) **não mudou nada**: ele continua chamando `/api/scores`. Essa é a
vantagem de ter uma API no meio, porque dá para trocar o banco sem mexer no jogo.

**Conceito: parâmetros `$1`, `$2` (proteção contra *SQL injection*).**
Nunca se cola o que o usuário digitou direto dentro do texto do SQL. Se fosse assim:
```js
// ❌ NUNCA FAÇA ISSO
pool.query(`INSERT INTO scores (name, score) VALUES ('${name}', ${score})`);
```
alguém poderia digitar como nome `'); DROP TABLE scores; --`, e o SQL final viraria *dois comandos*,
sendo o segundo o que apaga a tabela. O jeito certo é escrever `$1`, `$2` no lugar dos valores e
mandar os valores separados num array:
```js
// ✅ CERTO
pool.query('INSERT INTO scores (name, score) VALUES ($1, $2) RETURNING *', [name, score]);
```
O `pg` manda o SQL e os valores separados para o Postgres, que trata os valores **só como dados**.

**Conceito: `try/catch`.** O `pg` *lança* um erro quando algo falha (banco desligado, SQL errado…).
O `try { ... } catch (error) { ... }` "pega" esse erro e responde `500` ao navegador, em vez de deixar
o servidor quebrar. O Supabase funcionava diferente: devolvia `{ data, error }` e era preciso testar o `error`.

**Código principal:**
```js
// GET: top 10 do ranking
const result = await pool.query(
  'SELECT name, score, created_at FROM scores ORDER BY score DESC LIMIT 10'
);
res.json(result.rows);           // result.rows = array com as linhas

// POST: salvar um score
const result = await pool.query(
  'INSERT INTO scores (name, score) VALUES ($1, $2) RETURNING *',
  [name.trim().slice(0, 20), Math.floor(score)]
);
res.status(201).json(result.rows[0]);   // 201 = "criado"
```
| Parte | Significado |
|---|---|
| `ORDER BY score DESC` | ordena do maior score para o menor (`DESC` = decrescente) |
| `LIMIT 10` | traz no máximo 10 linhas |
| `RETURNING *` | o banco devolve a linha que acabou de criar (com `id` e data) |
| `name.trim().slice(0, 20)` | tira espaços das pontas e corta em 20 caracteres |
| `Math.floor(score)` | arredonda para baixo (garante número inteiro) |
| `await` | espera o banco responder antes de seguir |

**Arquivos:**
- [server.js](server.js): rotas reescritas com `pool.query` e `try/catch`
- `.env` e [.env.example](.env.example): `PORT=3001`

**Problema evitado: porta ocupada.** Outro projeto meu (um container Docker) já usa a porta `3000`.
Duas coisas não podem usar a mesma porta ao mesmo tempo. Como o `server.js` já lia `process.env.PORT`,
bastou colocar `PORT=3001` no `.env`, sem mudar o código.

**Como testar:**
```powershell
npm start
# Em outro terminal:
curl.exe http://localhost:3001/api/scores
curl.exe -X POST http://localhost:3001/api/scores -H "Content-Type: application/json" -d '{\"name\":\"carlos\",\"score\":100}'
```
(No PowerShell é `curl.exe`, porque `curl` sozinho é um apelido para outro comando. As aspas internas do
JSON precisam de `\"`.)

Resultados obtidos nos testes:
| Teste | Resposta |
|---|---|
| `GET /api/scores` | `[{"name":"teste","score":42,...}]` |
| `POST` com `carlos`/`100` | `{"id":"2","name":"carlos","score":100,...}` |
| `POST` com nome vazio | `{"error":"Nome invalido"}` (validação funcionando) |
| `POST` com nome `'); DROP TABLE scores; --` | salvou o texto como **nome**, e a tabela continuou existindo ✅ |
| `http://localhost:3001` no navegador | página do jogo (código 200) |

O teste de *injection* mostra que os parâmetros funcionam: o "ataque" virou só um nome esquisito no
ranking (cortado em 20 caracteres). Depois apaguei essa linha de teste com
`DELETE FROM scores WHERE id = 3;`.

**Pergunta para revisar:** *Por que o `game.js` não precisou mudar quando trocamos Supabase por Postgres?*
Porque o jogo nunca falou com o banco diretamente, só com a **API** (`/api/scores`) do nosso servidor.
Enquanto a API responder no mesmo formato, o frontend nem percebe que o banco mudou.

### Etapa 1, passo 5: limpeza do que sobrou do Projeto 2 ✍️

**O que:**
1. Apaguei a pasta `supabase/`.
2. Renomeei o projeto no [package.json](package.json) (`project2` → `project3`, em 4 lugares) e preenchi o `author`.
3. Corrigi o [.gitignore](.gitignore): `.env*` → `.env`.

**Por que:** tirar o que não serve mais e deixar o projeto com a identidade certa. Os arquivos da
Vercel (`api/` e o `if (!process.env.VERCEL)` no `server.js`) ficaram para a Etapa 2, junto com o Render.

**Conceito: curinga `*` no `.gitignore`.** O `*` significa "qualquer coisa". Por isso `.env*`
ignorava `.env`, `.env.example`, `.env.local`… Com só `.env`, apenas o arquivo com as senhas fica de
fora. O `.env.example` precisa ir para o GitHub, porque mostra a quem baixar o projeto **quais
variáveis** configurar, sem revelar os valores reais.

**Comandos usados:**
```powershell
Remove-Item -Recurse supabase                              # apaga a pasta e tudo dentro
node -e "console.log(require('./package.json').name)"      # testa se o JSON está válido
git status                                                 # .env.example deve aparecer; .env não
git check-ignore -v .env .env.example                      # mostra quais arquivos o Git ignora e por qual regra
```

**Como testar:**
- `node -e "console.log(require('./package.json').name)"` → `project3-2026b-cau19`
- `git status` → `.env.example` aparece como novo e `.env` **não** aparece
- `npm start` → `Servidor rodando em http://localhost:3001`

**Problema encontrado:** na primeira revisão o `package.json` continuava igual. Eu tinha editado, mas
**não tinha salvado**. No VS Code, a bolinha ● na aba indica alteração não salva (`Ctrl+S` para salvar).
Lição: ferramentas como `node`, `git` e o servidor leem o arquivo **do disco**, não o que está na tela do editor.

**Pergunta para revisar:** *Se o `.env` não vai para o GitHub, como o servidor no Render vai saber a
senha do banco?*
As mesmas variáveis (`DATABASE_URL`, `PORT`) são cadastradas no painel do Render, na seção de
*Environment Variables*. O `dotenv` lê o `.env` só na minha máquina; no Render, os valores já chegam
prontos em `process.env`.

---

**✅ Etapa 1 concluída:** o jogo roda localmente com PostgreSQL no Docker, sem nenhuma dependência do Supabase.

---

## Etapa 2: Deploy no Render

**Objetivo da etapa:** colocar o jogo na internet com um banco PostgreSQL na nuvem (Render), criado
manualmente pelo painel (sem *blueprints*).

### Etapa 2, passos 1 e 2: criar o banco no Render e a tabela ✍️

**O que:** criei um PostgreSQL no painel do Render (**+ New → Postgres**, nome `dino-db`, banco
`dinogame`, usuário `dino`, região Virginia, versão 16, plano Free) e rodei o
[db/schema.sql](db/schema.sql) nele.

**Por que:** o banco do Docker só existe no meu computador. O jogo publicado precisa de um banco
acessível pela internet.

**Conceito: URL interna × URL externa.** O Render mostra duas connection strings para o mesmo banco:
- **Internal Database URL:** só funciona *dentro* do Render. Quem vai usar é o servidor do jogo
  quando estiver hospedado lá (é mais rápida e não sai para a internet).
- **External Database URL:** funciona de qualquer lugar, inclusive do meu PC. Usei para criar a
  tabela e para testar.

**Comando para criar a tabela no Render:**
```powershell
Get-Content db/schema.sql | docker exec -i dino-postgres psql "URL_EXTERNA_DO_RENDER"
```
| Parte | O que faz |
|---|---|
| `Get-Content db/schema.sql` | lê o arquivo e devolve o texto (o `create table ...`) |
| `\|` (pipe) | entrega o texto da esquerda como entrada para o comando da direita |
| `docker exec -i dino-postgres` | executa um comando **dentro** do container; o `-i` deixa ele **receber** o texto do pipe |
| `psql` | cliente de linha de comando do PostgreSQL (manda SQL e mostra a resposta) |
| `"URL_..."` | **para qual banco** o `psql` deve se conectar |

```
 meu PC                          container dino-postgres               nuvem (Render)
┌──────────────┐   pipe |    ┌──────────────────────────┐  internet  ┌──────────────┐
│ schema.sql   │ ──────────▶ │ psql (só o cliente)      │ ─────────▶ │ banco dino-db│
│ (o texto)    │             │                          │    SSL     │ CREATE TABLE │
└──────────────┘             └──────────────────────────┘            └──────────────┘
```

**O truque:** o container tem o **servidor** Postgres (o banco local) *e* o **cliente** `psql`.
Sem URL (`psql -U dino -d dinogame`), o cliente fala com o servidor do próprio container. **Com** URL,
o mesmo cliente fala com um servidor **em outro lugar**. Usei o container só como "caixa de
ferramentas", para não instalar o `psql` no Windows.
*Analogia:* usar o telefone de casa (o `psql` do container) para ligar para outro número (o Render).
O `schema.sql` é o recado e o pipe é eu lendo o recado no telefone.

**Segurança:** a URL externa contém a senha do banco, então não deve ser colada em chat, código ou README.

**Pergunta para revisar:** *Por que o servidor no Render vai usar a URL interna e não a externa?*
Porque os dois (servidor e banco) estarão dentro do Render: a URL interna é mais rápida e não expõe o
tráfego à internet. A externa serve para acessar de fora, como do meu PC.

### Etapa 2, passo 3: preparar o código para o Render ✍️

**O que:**
1. **SSL** no [database.js](database.js): conexão criptografada quando o banco não é local.
2. **Remover as sobras da Vercel:** pasta `api/`, o `if (!process.env.VERCEL)` e o
   `module.exports = app` no [server.js](server.js), e a linha `.vercel` no [.gitignore](.gitignore).

**Código do SSL:**
```js
// O banco local (Docker) nao usa SSL; o banco do Render exige conexao criptografada
const isLocal = process.env.DATABASE_URL.includes('localhost');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});
```
- `.includes('localhost')` devolve `true` se a URL contém `localhost`.
- `condição ? A : B` é o **operador ternário**, um `if/else` numa linha só.
- `{ rejectUnauthorized: false }` liga o SSL e aceita o certificado do Render sem precisar baixar
  arquivos de certificado (caminho comum em projetos didáticos).

**Conceito: SSL.** Criptografa a conversa entre o servidor e o banco. Pela internet, sem SSL, alguém no
meio do caminho poderia ler as senhas e os dados. O banco do Docker está no próprio PC (o tráfego não
sai da máquina), então não precisa.

**Conceito: Vercel × Render (diferença para explicar em sala).**
| | Vercel (Projeto 2) | Render (Projeto 3) |
|---|---|---|
| Modelo | *serverless*: o código liga a cada requisição e desliga depois | **servidor tradicional**: roda `npm start` e fica ligado |
| Precisava de | adaptador (`api/[...path].js`) e `module.exports = app` | nada especial: igual a rodar no meu PC |
| `app.listen` | não podia ser chamado (por isso o `if`) | sempre chamado |

**Como testar:**
1. Com o `.env` no banco local: `npm start` e depois `curl.exe http://localhost:3001/api/scores` →
   `carlos` e `teste` ✅
2. Trocando temporariamente a `DATABASE_URL` do `.env` pela URL externa do Render: a mesma requisição →
   `[]` (tabela vazia do Render) ✅. Isso prova que o SSL funciona e que a tabela existe lá (se não
   existisse, a resposta seria erro 500). **Depois, voltei o `.env` para o banco local.**

**Problema encontrado: servidor "fantasma" na porta 3001.** Na revisão, o servidor de teste devolveu
`[]` mesmo com o `.env` apontando para o banco local, que tem 2 scores. Investigando, um `npm start`
antigo (iniciado quando o `.env` apontava para o Render) ainda estava ligado e ocupando a porta 3001.
O teste estava falando com *ele*.
Lições:
- O `dotenv` lê o `.env` **só quando o servidor liga**. Mudou o `.env`? **Reinicie** o servidor (`Ctrl+C` e `npm start`).
- Duas coisas não usam a mesma porta. O segundo servidor deveria dar erro (`EADDRINUSE`), mas no
  **Express 5** esse erro é entregue à função do `app.listen`. Como a nossa função ignora esse erro,
  o servidor imprimiu "rodando" e fechou sem avisar. Correção possível (ainda não aplicada):
  ```js
  app.listen(PORT, (error) => {
    if (error) throw error;   // ex.: porta ocupada (EADDRINUSE)
    console.log(`Servidor rodando na porta ${PORT}`);
  });
  ```

**Pergunta para revisar:** *O que acontece se eu mudar o `.env` com o servidor ligado?*
Nada, até reiniciar. O `dotenv` lê o arquivo uma única vez, na inicialização, e coloca os valores em
`process.env`.

### Etapa 2, passo 4: commit, push e Web Service no Render ✍️ (commit feito pela IA, a meu pedido)

**O que:**
1. Fiz o commit único com todo o trabalho até aqui e enviei para o GitHub (`git push`).
2. Criei no Render um **Web Service** ligado ao repositório: Node, `npm install` / `npm start`,
   plano Free, região **Virginia** (a mesma do banco), com a variável `DATABASE_URL` = **Internal
   Database URL** do `dino-db`.

**Resultado:** o jogo está no ar na URL pública do Render e salva os scores no banco da nuvem. ✅

**Conceito: Web Service.** Um "computador na nuvem" que baixa meu código do GitHub, roda
`npm install` (instala as dependências do `package.json`) e depois `npm start` (liga o servidor).
**A cada `git push` na `main`, o Render faz um deploy novo sozinho.**

**Conceito: variáveis de ambiente no Render.** O `.env` não vai para o GitHub (está no `.gitignore`),
então o Render não sabe a senha do banco. Ela é cadastrada no painel (*Environment*) e chega pronta em
`process.env.DATABASE_URL`, o mesmo papel que o `dotenv` faz no meu PC. A `PORT` **não** é
cadastrada: o Render escolhe a porta (normalmente `10000`) e o código já usa `process.env.PORT || 3000`.

**Conceito: autoria no Git.** Antes do primeiro commit, o Git pediu nome e e-mail do autor. Configurei
**só neste repositório** (sem `--global`):
```powershell
git config user.name "Carlos Henrique Mendina Gonçalves Pereira"
git config user.email "cau.pereira2002@gmail.com"
```
O e-mail precisa ser o mesmo da conta do GitHub para o commit aparecer ligado ao meu perfil. A linha
`Co-Authored-By: Claude` no commit deixa transparente que houve colaboração da IA.

**Antes do commit, sempre:** `git status` e conferir que o **`.env` não aparece** na lista.

**Pergunta para revisar:** *Como eu atualizo o jogo que está no ar?*
Faço as alterações, testo localmente, depois `git add`, `git commit` e `git push`. O Render percebe o
push e faz o deploy sozinho (dá para acompanhar pelos logs no painel).

---

**✅ Etapa 2 concluída:** jogo publicado no Render, com PostgreSQL na nuvem.

---

> **Mudança no modo de trabalho (19/10/2026, véspera da entrega):** com pouco tempo, pedi para a IA
> implementar o restante do projeto de uma vez. As etapas a seguir foram **escritas pela IA (📓)**
> e registradas aqui em detalhe para eu estudar, conseguir explicar cada decisão e apresentar.
> Os testes automáticos (Etapa 6) e os testes no navegador comprovam que tudo funciona.

---

## Etapa 3: Como usuários e dados se relacionam (modelagem do banco) 📓

**O que:** reescrevi o [db/schema.sql](db/schema.sql) com 4 tabelas e criei o
[db/reset.sql](db/reset.sql) (apaga tudo, para recomeçar do zero quando a estrutura muda).

```
                 ┌──────────────┐
                 │    skins     │  catálogo: id, nome, preço, cor
                 └──────┬───────┘
         selected_skin  │   ▲ skin_id
        (N para 1)      │   │
┌──────────────┐        │   │        ┌──────────────┐
│    users     │◀───────┘   └────────│  user_skins  │  quais skins cada um comprou
│ id, username │◀────────────────────│ user_id      │  (N para N)
│ password_hash│                     └──────────────┘
│ credits      │
└──────┬───────┘
       │ 1 para N
       ▼
┌──────────────┐
│    scores    │  cada score tem um dono (user_id)
└──────────────┘
```

**Conceitos:**
- **Chave estrangeira (`references`)**: `scores.user_id references users(id)` faz o banco **recusar**
  um score de um usuário que não existe. É o banco garantindo a regra, não só o código.
- **`on delete cascade`**: se um usuário for apagado, os scores dele somem junto.
- **Tabela de ligação (N para N)**: um usuário tem várias skins e uma skin tem vários donos. A tabela
  `user_skins` guarda os pares. A **chave primária dupla** `(user_id, skin_id)` impede comprar a mesma
  skin duas vezes.
- **`check (credits >= 0)`**: o banco recusa saldo negativo, mesmo se o código tiver um bug.
- **`unique`** no `username`: dois usuários não podem ter o mesmo nome.
- **Índice** em `scores(user_id)`: deixa rápido buscar "os scores do usuário X".
- **`insert ... on conflict do update`**: cadastra as skins e, se já existirem, atualiza preço/nome.
  Assim o arquivo pode rodar várias vezes.

**Por que tirei a coluna `name` dos scores:** no Projeto 2 qualquer um digitava um nome. Agora o
score pertence a um **usuário autenticado**, e o nome vem da tabela `users`.

### Docker Compose (substituindo o `docker run`)
Criei o [docker-compose.yml](docker-compose.yml). Em vez de decorar o `docker run` comprido, basta:
```powershell
docker compose up -d      # cria/liga o banco
docker compose down       # desliga (os dados continuam no volume)
```
- **Volume (`dino-data`)**: uma "pasta" do Docker onde os dados ficam guardados, mesmo se o
  container for apagado e recriado.
- **`/docker-entrypoint-initdb.d/`**: a imagem do Postgres roda automaticamente os `.sql` dessa pasta
  **na primeira vez** que o banco é criado. Montei o `schema.sql` ali, então o banco já nasce com as tabelas.
- Mantive o nome `dino-postgres`, então os comandos `docker exec dino-postgres psql ...` continuam valendo.
- O container antigo (do `docker run`) foi apagado e recriado pelo Compose. Os dados de teste antigos
  não serviam mais, porque a estrutura mudou.

**Pergunta para revisar:** *Por que `user_skins` não é só uma coluna "skins" dentro de `users`?*
Porque um usuário pode ter **várias** skins. Uma coluna guardaria um valor só. A tabela de ligação
guarda um par (usuário, skin) por linha, e o banco garante que cada par não se repete.

---

## Etapa 4: Cadastro, login e logout (backend) 📓

**Arquivos:** [auth.js](auth.js) (novo) e as rotas `/api/register` e `/api/login` no [server.js](server.js).
Bibliotecas novas: `bcryptjs` e `jsonwebtoken`.

### Cadastro: `POST /api/register`
1. Valida: usuário com 3 a 20 letras/números/`_` (regex) e senha de 6 a 72 caracteres.
2. `bcrypt.hash(senha, 10)` gera o **hash** da senha.
3. Salva `username` + `password_hash` (a senha em si **nunca** é salva).
4. Nome repetido → o `unique` do banco recusa (código `23505`) → respondemos **409**.
5. Devolve um **token**, então o usuário já fica logado.

**Conceito: hash de senha.** É uma "impressão digital" embaralhada que não dá para desfazer:
```
"senha123"  ──bcrypt──▶  "$2b$10$N9qo8uLOickgx2ZMRZoMye..."
```
No login, o bcrypt embaralha a senha digitada do mesmo jeito e compara. Se alguém roubar o banco, não
descobre as senhas. O `10` é o **custo** (quantas rodadas): deixa cada tentativa lenta de propósito,
o que atrapalha quem tenta adivinhar senhas em massa.
Usei o `bcryptjs` (JavaScript puro) em vez do `bcrypt`, que precisa compilar código C no Windows e
costuma dar erro na instalação. Os dois fazem a mesma coisa.

### Login: `POST /api/login`
1. Busca o usuário pelo nome.
2. `bcrypt.compare(senhaDigitada, hashSalvo)`.
3. Errou → **401** com a mensagem *"Usuario ou senha incorretos"*. A mensagem é a **mesma** para "não
   existe" e "senha errada", para quem tenta invadir não descobrir quais nomes existem.
4. Acertou → devolve o token.

**Conceito: token JWT.** Um "crachá" assinado pelo servidor:
```
eyJhbGciOiJIUzI1NiJ9 . eyJpZCI6IjEiLCJ1c2VybmFtZSI6ImNhcmxvcyJ9 . assinatura
    cabeçalho              dados: { id, username }                 assinatura
```
- Os dados **não são secretos** (dá para ler colando em jwt.io). Por isso nunca vai senha dentro.
- A **assinatura** é feita com o `JWT_SECRET` (só o servidor sabe). Se alguém mudar o `id` dentro do
  token para fingir ser outra pessoa, a assinatura não bate e o servidor recusa.
- Expira em **7 dias** (`expiresIn: '7d'`).
- *Analogia:* pulseira de festa que só o organizador consegue fabricar.

### Middleware `requireAuth` (o "porteiro")
```js
function requireAuth(req, res, next) {
  const [type, token] = (req.headers.authorization || '').split(' ');   // "Bearer <token>"
  if (type !== 'Bearer' || !token) return res.status(401).json({ error: 'Faca login para acessar' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);   // confere assinatura e validade
    next();                                                   // deixa passar para a rota
  } catch {
    return res.status(401).json({ error: 'Sessao invalida ou expirada...' });
  }
}
// uso:  app.get('/api/me', requireAuth, async (req, res) => { ... req.user.id ... })
```
**Middleware** é uma função que roda **antes** da rota. Se o token for inválido, a rota nem executa.

### Logout
Com JWT o servidor **não guarda sessão**: quem "lembra" do login é o navegador, que guarda o token.
Logout = o navegador **apagar o token** (função `logout()` em [public/auth.js](public/auth.js)). Sem
token, as rotas protegidas voltam a responder 401.
*Limitação conhecida:* um token copiado continuaria válido até expirar (7 dias). Uma melhoria futura
seria uma lista de tokens revogados no banco.

**Variável nova:** `JWT_SECRET` no `.env` (gerada com
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) e no painel do Render.

**Pergunta para revisar:** *O que impede alguém de criar um token dizendo `id: 1` e acessar a conta do usuário 1?*
A assinatura. Para gerar uma assinatura válida é preciso o `JWT_SECRET`, que só existe no servidor
(`.env` e painel do Render), nunca no GitHub nem no navegador.

---

## Etapa 5: Operações protegidas e autorização 📓

**Autenticação × autorização:**
- **Autenticação** = *quem é você?* → o token (middleware `requireAuth`). Falhou → **401**.
- **Autorização** = *você pode fazer ISSO?* → regras em cada rota. Falhou → **403** ou **404**.

**Regra de ouro do projeto:** o id do usuário vem **sempre do token** (`req.user.id`), nunca do corpo
do pedido. Assim ninguém consegue agir em nome de outra pessoa mandando outro id.

| Rota | Quem pode | Como o servidor garante |
|---|---|---|
| `POST /api/register`, `POST /api/login` | qualquer um | — |
| `GET /api/scores` (ranking) | qualquer um | — |
| `GET /api/skins` (catálogo) | qualquer um | — |
| `GET /api/me` | logado | `requireAuth` |
| `POST /api/scores` | logado | `requireAuth`; o score é salvo com `user_id = req.user.id` |
| `GET /api/me/scores` | logado, **só os seus** | `WHERE user_id = $1` com o id do token |
| `DELETE /api/scores/:id` | logado, **só o dono** | `DELETE ... WHERE id = $1 AND user_id = $2` → apagar o de outro afeta 0 linhas → **404** |
| `GET /api/medals` | logado | `requireAuth` (a seção é exclusiva de autenticados, **no servidor**) |
| `POST /api/skins/:id/buy` | logado, com créditos | transação + `FOR UPDATE` + checagem de saldo |
| `PUT /api/me/skin` | logado, **só skin que tem** | `SELECT` confere se é grátis ou comprada → senão **403** |

**Por que apagar score de outro dá 404 e não 403?** Para não revelar que aquele score existe. Para
quem não é dono, é como se não existisse.

### Créditos e transações
- Ao salvar um score: **créditos = score ÷ 10 + 5 × moedas** (arredondado para baixo).
- **Transação** (`BEGIN` … `COMMIT` / `ROLLBACK`): salvar o score e somar os créditos acontecem
  **juntos ou nenhum**. Se der erro no meio, o `ROLLBACK` desfaz tudo.
  *Analogia:* transferência bancária: não pode sair dinheiro de uma conta sem entrar na outra.
- Para usar transação é preciso **uma conexão só** do pool: `const client = await pool.connect()` … e no
  fim `client.release()` (devolve a conexão).
- **`SELECT ... FOR UPDATE`** na compra de skin: "trava" a linha do usuário até o fim da transação.
  Se dois pedidos de compra chegarem ao mesmo tempo, o segundo **espera** o primeiro terminar, e o saldo
  não é gasto duas vezes.

### Anti-trapaça (limitação honesta)
O score é calculado no navegador, então alguém poderia mandar um score falso pela API. O servidor faz
checagens simples (score inteiro entre 0 e 1.000.000; moedas no máximo `score/20 + 3`), mas **não dá
para garantir 100%** sem rodar o jogo no servidor. Para um projeto didático, deixei registrado como
limitação conhecida.

### Medalhas (calculadas na hora, com SQL)
Não há "tarefa agendada" distribuindo medalhas: a consulta calcula o top 3 de cada período sempre que
alguém abre a aba.
```sql
WITH best AS (            -- 1) melhor score de cada usuário em cada período
  SELECT to_char(s.created_at AT TIME ZONE 'America/Sao_Paulo', $1) AS period,   -- $1 = 'YYYY-MM' ou 'YYYY'
         u.id AS user_id, u.username, MAX(s.score) AS best_score
  FROM scores s JOIN users u ON u.id = s.user_id
  GROUP BY period, u.id
),
ranked AS (               -- 2) posição dentro de cada período
  SELECT *, RANK() OVER (PARTITION BY period ORDER BY best_score DESC)::int AS position
  FROM best
)
SELECT period, username, best_score, position, (user_id = $2) AS is_me
FROM ranked WHERE position <= 3      -- 3) só o pódio
ORDER BY period DESC, position;
```
- **`WITH` (CTE)**: dá nome a uma consulta intermediária, como uma "tabela temporária".
- **`AT TIME ZONE 'America/Sao_Paulo'`**: o banco guarda em UTC. Um score às 22h do dia 31 no Brasil já
  é dia 1º em UTC. Converter antes evita a medalha cair no mês errado.
- **`to_char(..., 'YYYY-MM')`**: transforma a data em texto do mês (`2026-10`). Com `'YYYY'`, do ano.
  A **mesma consulta** serve para mensal e anual, só trocando o `$1`.
- **`RANK() OVER (PARTITION BY period ...)`**: *função de janela*. Numera 1, 2, 3… **separadamente em
  cada período**. Empates recebem a mesma posição.
- **`::int`**: o `RANK()` devolve `bigint`, que chega no JavaScript como texto (`"1"`). Converter para
  inteiro evita comparar `"1" === 1` (falso).
- Medalhas do mês/ano **em andamento** aparecem com a etiqueta "em andamento" (ainda podem mudar).

**Pergunta para revisar:** *Se a aba Medalhas fosse só escondida no HTML para quem não está logado, qual seria o problema?*
Qualquer pessoa poderia chamar `GET /api/medals` direto (pelo navegador, `curl` etc.) e ver os
dados. A proteção de verdade é o `requireAuth` no servidor, que responde 401 sem token. Por isso o
frontend **nem esconde** a aba: ele pede ao servidor e mostra o 401 que recebe.

---

## Etapa 6: Testes de acessos permitidos e não permitidos 📓

**Arquivo:** [tests/api.test.js](tests/api.test.js). Usa só o que vem no Node (`node:test`, `assert`,
`fetch`), sem bibliotecas extras.

**Como rodar** (com o servidor ligado em outro terminal):
```powershell
npm test
# Contra o site publicado:
$env:BASE_URL="https://SEU-APP.onrender.com"; npm test
```
O teste cria dois usuários novos (Alice e Bob, com nomes únicos a cada execução) e verifica:

| # | Teste | Esperado |
|---|---|---|
| 1 | cadastro válido | 201 + token |
| 2 | nome repetido | **409** |
| 3 | senha curta | **400** |
| 4 | login certo | 200 + token |
| 5 | senha errada | **401** |
| 6 | 7 rotas protegidas **sem token** | **401** em todas |
| 7 | token **falsificado** (assinatura alterada) | **401** |
| 8 | Alice salva score 1500 com 10 moedas | 201, ganha 150 + 50 = 200 créditos |
| 9 | moedas impossíveis (500 moedas com score 10) | **400** |
| 10 | Bob lista os scores dele | não vê o score da Alice |
| 11 | Bob tenta **apagar o score da Alice** | **404** e o score continua existindo |
| 12 | Alice vê as medalhas | 200, ela aparece no pódio |
| 13 | comprar skin sem créditos | **400** |
| 14 | equipar skin não comprada | **403** |
| 15 | comprar skin com créditos, tentar de novo e equipar | 201 → 409 → 200 |
| 16 | Alice apaga o próprio score | 204 |

**Resultado:** `ℹ tests 16 · ℹ pass 16 · ℹ fail 0` ✅

**Problema encontrado:** na primeira execução, 1 teste falhou com
`Request with GET/HEAD method cannot have body`. O erro estava **no teste** (mandava corpo `{}` num
`GET`), não no servidor. Corrigido mandando corpo só nos outros métodos.

Também apareceu, durante os testes, o erro `EADDRINUSE` (porta ocupada) **de forma clara**, graças à
correção do `app.listen` que eu tinha feito antes ✍️ (`if (error) throw error`).

Além disso, testei tudo num **navegador real** (Chrome sem interface, controlado por script): cadastro pela
tela, salvar score pendente após login, compra de skin, apagar score, logout mostrando 401, layout no
celular, sem erros no console.

---

## Etapa 7: Frontend integrado com a autenticação 📓

**Arquivos:** [public/index.html](public/index.html), [public/style.css](public/style.css), e o
JavaScript dividido em 3 partes:

| Arquivo | Responsabilidade |
|---|---|
| [public/game.js](public/game.js) | o jogo (física, desenho, sons) |
| [public/auth.js](public/auth.js) | token, login/cadastro/logout, função `api()` |
| [public/app.js](public/app.js) | abas, ranking, meus scores, medalhas, loja, fim de partida |

### A função `api()` (em auth.js)
Todo pedido ao servidor passa por ela:
```js
if (memoryToken) headers.Authorization = `Bearer ${memoryToken}`;   // manda o "crachá"
const res = await fetch(path, { method, headers, body });
if (!res.ok) { ...; if (res.status === 401 && memoryToken) logout(); throw error; }
```
- O token fica no **`localStorage`** (continua logado ao recarregar a página).
- Se o servidor responder 401 com um token guardado → o token expirou → sai da conta sozinho.

### Abas protegidas mostram o 401 do servidor
"Meus scores 🔒" e "Medalhas 🔒" **não são escondidas** de quem não está logado. Ao abrir, o
frontend pede os dados ao servidor; sem token, o servidor responde **401** e a tela mostra:
> 🔒 **Acesso negado pelo servidor** `HTTP 401`. Faca login para acessar

Isso foi feito **de propósito**, por causa do aviso da professora (*"restringir funcionalidades apenas no
frontend não é suficiente"*): a demonstração mostra que **quem bloqueia é o backend**. A loja faz o
mesmo: sem login, o botão de comprar tenta a compra, o servidor recusa com 401 e abre a janela de login.

### Fluxos
- **Jogar sem conta:** pode jogar, mas no fim aparece *"Entre ou cadastre-se para salvar este score"*.
  Se entrar ou cadastrar ali, **o score daquela partida é salvo** logo depois do login (`pendingResult`).
- **Logado:** o score é salvo automaticamente no fim da partida e mostra *"✓ Score salvo! +N créditos"*,
  com aviso de 🏆 novo recorde.
- **Meus scores:** tabela com data, score, moedas e botão **Apagar** (pede confirmação).
- **Loja:** prévia de cada skin, preço, e botões "Comprar", "Usar", "Em uso ✓" ou "Faltam N".
- **Ranking:** melhor score de cada jogador, com a cor da skin dele e destaque para "(você)".

### Segurança no frontend
- **`escapeHtml()`**: tudo que vem do servidor e entra no HTML passa por essa função, para um nome de
  usuário nunca virar código HTML/JS (proteção contra **XSS**).
- `localStorage` dentro de `try/catch`: em janela anônima ou com bloqueio, o site continua funcionando.

**Pergunta para revisar:** *Onde o token fica guardado e o que acontece no logout?*
No `localStorage` do navegador. No logout ele é apagado; sem token, a função `api()` não manda o
cabeçalho `Authorization` e o servidor recusa as rotas protegidas.

---

## Etapa 8: Jogabilidade 📓

### 1. Velocidade independente da taxa de atualização do monitor
**Problema do Projeto 2:** tudo andava "X pixels **por quadro**". O `requestAnimationFrame` roda na
frequência do monitor, então num monitor de **144 Hz o jogo ficava 2,4× mais rápido** que em 60 Hz.

**Solução: delta time (`dt`).** Tudo agora é em **pixels por segundo** e multiplicado pelo tempo que
passou desde o quadro anterior:
```js
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, MAX_DT);   // segundos desde o último quadro
  lastTime = now;
  if (state === 'playing') update(dt);
  ...
}
// dentro do update:
obstacles.forEach((o) => (o.x -= speed * dt));   // speed em px/s
```
- 60 Hz → `dt ≈ 0,0167 s` → anda `340 × 0,0167 ≈ 5,7 px` por quadro
- 144 Hz → `dt ≈ 0,0069 s` → anda `340 × 0,0069 ≈ 2,4 px` por quadro
- Em **1 segundo**, os dois andam **340 px**.
- `MAX_DT` (1/30 s): se o navegador travar, o dino não "teleporta" através de um cacto.

**Pulo com a fórmula exata da física** (movimento com aceleração constante):
```js
dino.bottom += dino.vy * dt + 0.5 * gravity * dt * dt;   // s = v·t + ½·a·t²
dino.vy     += gravity * dt;                              // v = v₀ + a·t
```
**Medição** (simulando o mesmo pulo com dt diferentes):

| Monitor | Altura do pulo | Distância em 1 s |
|---|---|---|
| 60 Hz | 129,3 px | 343 px |
| 144 Hz | 129,3 px | 345 px |
| 240 Hz | 129,3 px | 345 px |

Com a fórmula simples (`vy += g·dt; y += vy·dt`) a altura variava de 122,5 a 127,6 px (~4%). Com a
fórmula exata, ficou idêntica.

### 2. Progressão e variedade
- **Velocidade** começa em 340 px/s e sobe 6 px/s a cada segundo até 900 px/s (~93 s).
- **Pontuação** pela distância percorrida (1 ponto a cada 40 px): quanto mais rápido, mais pontos por segundo.
- **Obstáculos que aparecem com o tempo:**
  - desde o início: cacto pequeno e grande;
  - a partir de 150 pontos: **grupos** de 2 ou 3 cactos;
  - a partir de 300 pontos: **pássaros** em 3 alturas (baixo: pular; meio: abaixar ou pulo alto; alto: **não** pular).
- **Espaço entre obstáculos** cresce com a velocidade: sempre dá tempo de pousar e pular de novo.
- **Moedas** (35% de chance entre obstáculos), em 3 alturas: valem créditos para a loja.
- **Ciclo dia/noite** a cada 700 pontos, com transição suave, estrelas e lua.

### 3. Controles com mais "sensação"
- **Pulo variável:** segurar = pulo alto; soltar cedo = pulo curto (`JUMP_CUT_VELOCITY`).
- **Buffer de pulo:** apertar até 0,12 s antes de tocar o chão ainda conta.
- **Abaixar** (`↓`): passa por baixo de pássaros; no ar, cai 3× mais rápido.
- **Pausa** com `P`/`Esc` e automática ao trocar de aba do navegador.
- **Hitbox** um pouco menor que o desenho (os cantos do sprite são transparentes).
- Toque na tela funciona no celular.

### 4. Visual e som
- Canvas em **alta resolução** (`devicePixelRatio`): nítido em telas de celular e notebooks modernos.
- Placar no estilo do jogo original (`HI 01601  00123`), que **pisca a cada 100 pontos**.
- Partículas: poeira ao pousar e brilho ao pegar moeda, com "+1" flutuando. A tela treme ao morrer.
- **Sons** gerados na hora com a Web Audio API (sem arquivos): pulo, moeda, marco de 100 pontos e morte.
  Botão 🔊 / tecla `M` para silenciar.

### 5. Skins no jogo
Os sprites são **pintados** com a cor da skin num canvas separado:
```js
g.drawImage(img, 0, 0);
g.globalCompositeOperation = 'source-in';  // a tinta só "pega" onde já havia pixel
g.fillStyle = color;
g.fillRect(0, 0, c.width, c.height);
```
Skins especiais: **Clássico** acompanha o dia/noite, **Fantasma** é semi-transparente e pulsa,
**Arco-íris** troca de cor continuamente (12 versões pré-pintadas).

**Problema encontrado:** nos testes, o dino aparecia como um **bloco** colorido quando estava no ar e
na loja. Investigando os pixels, o `dinoparado.png` (do Projeto 2) **não tinha fundo transparente**:
era branco. No Projeto 2 não aparecia porque o fundo da página também era branco.
**Solução:** antes de pintar, os pixels quase brancos (R, G e B > 200) viram transparentes.

**Pergunta para revisar:** *Por que no Projeto 2 o jogo ficava mais rápido em monitores de 144 Hz?*
Porque o movimento era "pixels por quadro" e o `requestAnimationFrame` roda uma vez por atualização
do monitor: 144 quadros por segundo = 144 movimentos por segundo. Com `dt`, o movimento passou a ser
"pixels por segundo", independente de quantos quadros acontecem.

---

## Etapa 9: Deploy da versão final 📓 (passos no painel ✍️)

**Site publicado:** https://dino-game-d3y2.onrender.com

O que mudou no Render em relação à Etapa 2:
1. ✍️ **Nova variável de ambiente** no Web Service: `JWT_SECRET`, gerada pelo botão **Generate** do
   próprio Render. Ela é **diferente** da do meu `.env`, então um token criado no meu PC não vale no site
   publicado (e vice-versa).
2. ✍️ **Recriei as tabelas** no banco do Render, porque a estrutura mudou (os scores antigos eram
   anônimos e de teste), com a URL **externa**:
   ```powershell
   Get-Content db/reset.sql  | docker exec -i dino-postgres psql "URL_EXTERNA"
   Get-Content db/schema.sql | docker exec -i dino-postgres psql "URL_EXTERNA"
   ```
3. 📓 `git push` (6 commits): o Render fez o deploy sozinho.
4. 📓 Conferido: `$env:BASE_URL="https://dino-game-d3y2.onrender.com"; npm test` → **16 de 16 testes
   passando no site publicado** ✅

**Problema encontrado: acentos viraram `?` no banco do Render.** A API publicada devolvia `Cl??ssico`
e `Arco-??ris`. No banco local estava certo.
- **Causa:** no **Windows PowerShell 5.1**, quando o texto passa por um `|` para um programa externo
  (o `docker`), o PowerShell converte o texto para uma codificação antiga (ASCII), que não tem letras
  acentuadas. Cada letra acentuada virou `?`. No banco local não aconteceu porque o Docker Compose
  leu o arquivo **direto**, sem passar pelo PowerShell.
- **Solução:** pedir para o `psql` ler o arquivo direto, com `-f`, sem o `|`. O `schema.sql` já está
  dentro do container (o `docker-compose.yml` monta ele em `/docker-entrypoint-initdb.d/`):
  ```powershell
  docker exec dino-postgres psql "URL_EXTERNA" -f /docker-entrypoint-initdb.d/schema.sql
  ```
  Como o `schema.sql` usa `if not exists` e `on conflict do update`, rodar de novo **não apaga nada**:
  só reescreve os nomes das skins com os acentos certos.
- **Lição:** a primeira forma (`Get-Content | ...`) só funcionou na Etapa 2 porque aquele SQL não
  tinha nenhuma letra acentuada.

**Usuários de teste no site:** os testes automáticos criam usuários `alice_…` e `bob_…` no banco
publicado. No fim do teste os scores deles são apagados, então eles não aparecem no ranking nem nas
medalhas.

---

## 🎤 Roteiro para a apresentação (3 a 5 min)

1. **Proposta (30 s):** Dino Game do Projeto 2 ganhou contas de usuário, scores pessoais, medalhas
   mensais/anuais e loja de skins com créditos ganhos jogando.
2. **Demonstração (1 min 30 s):**
   - jogar sem conta → no fim, "entre para salvar" → cadastrar → score salvo, créditos ganhos;
   - comprar e usar uma skin;
   - "Meus scores" → apagar um;
   - **sair** → abrir "Medalhas" → **"Acesso negado pelo servidor HTTP 401"**.
3. **Segurança no backend (1 min):** mostrar o `requireAuth` ([auth.js](auth.js)) e o
   `DELETE ... WHERE id = $1 AND user_id = $2` ([server.js](server.js)). Rodar `npm test` e mostrar os
   16 testes, com destaque para "Bob não consegue apagar o score da Alice".
4. **Decisões (1 min):** PostgreSQL no Render + Docker Compose local; bcrypt + JWT; transações nas
   compras; `dt` para o jogo não depender do monitor.
5. **Processo e uso de IA (30 s):** governança com a skill `mentor` (a IA explica → eu decido → tutorial
   ou código → revisão), este diário como evidência, o que eu fiz (✍️) e o que a IA fez (📓), e a
   aceleração na reta final.

## ❓ Perguntas prováveis da professora

| Pergunta | Resposta curta |
|---|---|
| Onde está a proteção das rotas? | No middleware `requireAuth` do servidor: sem token válido → 401, e a rota nem executa. |
| E se alguém chamar a API direto, sem o site? | Mesma coisa: quem decide é o servidor. Os testes fazem exatamente isso. |
| Como um usuário é impedido de apagar o score de outro? | O id vem do token, e o `DELETE` filtra por `user_id`. O de outra pessoa afeta 0 linhas → 404. |
| Como a senha é guardada? | Só o hash bcrypt (custo 10). Nem eu consigo ver as senhas. |
| O que tem dentro do token? | `id` e `username`, assinados com o `JWT_SECRET`. Não é secreto, mas não dá para alterar. |
| Como funciona o logout? | O navegador apaga o token. Com JWT o servidor não guarda sessão. |
| Diferença entre 401 e 403? | 401 = não sei quem você é (sem login). 403 = sei quem você é, mas não pode (ex.: skin não comprada). |
| Por que transação na compra? | Descontar créditos e liberar a skin precisam acontecer juntos; o `FOR UPDATE` evita gastar duas vezes. |
| Como as medalhas são calculadas? | Consulta SQL com `RANK() OVER (PARTITION BY período)`, no fuso de Brasília. |
| Onde o Docker entra? | No banco local: `docker compose up -d` sobe o Postgres já com as tabelas. |
| O jogo roda igual em qualquer monitor? | Sim: movimento em px/s × `dt`. Medi a altura do pulo: 129,3 px em 60, 144 e 240 Hz. |

---

## Etapa 10: README final e GIF de demonstração 📓

- A professora liberou o uso de IA no README do Projeto 3, então pedi para a IA montar o
  [README.md](README.md) completo a partir do template da disciplina (`classes/17/assets/README.template.md`),
  incluindo a seção **Processo**, escrita com base neste diário.
- O **GIF** (`demo.gif`) foi gravado automaticamente: um script abre o site no Chrome sem interface,
  um "robô" joga (pula cactos, abaixa nos pássaros) e o script tira um print a cada ~100 ms. Depois os
  prints viram um GIF (bibliotecas `puppeteer-core`, `pngjs` e `gif-encoder-2`, usadas só numa pasta
  temporária, fora do projeto). O GIF mostra: partida de dia, noite, fim de jogo com créditos, loja,
  medalhas, meus scores e o **401 depois do logout**.

---

## Etapa 11: Guia dos arquivos 📓

Para entender o papel de cada arquivo, criei o [docs/ARQUIVOS.md](docs/ARQUIVOS.md). Ele tem o mapa da
pasta, o caminho de um pedido passando pelos arquivos (do clique na aba até o banco), uma tabela por
arquivo com links para as linhas principais e um resumo do tipo "se eu quiser mudar X, mexo em...".
