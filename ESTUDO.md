# Diário de estudo: Projeto 3 (Dino Game com usuários)

Registro de cada passo do desenvolvimento: o que foi feito, por quê, os conceitos envolvidos e como
testar. Serve para estudar depois e apresentar em sala.

**Legenda de autoria:** 🤖 a IA escreveu (eu aprovei antes) · ✍️ eu escrevi (com tutorial e revisão da IA)

---

## Etapa 0: Preparação

### Etapa 0, passo 1: copiar o Projeto 2 🤖

**O que:** copiei todos os arquivos do `project2-2026b-cau19` para este repositório, **menos a pasta
`.git`**.

**Por que:** o Projeto 3 é uma atualização do Projeto 2. A pasta `.git` guarda o histórico e o
endereço do repositório no GitHub. Se ela fosse copiada, este projeto passaria a "ser" o Projeto 2.
Sem ela, o Projeto 3 mantém o próprio histórico.

**Observação:** o `.gitignore` ignora todos os arquivos que começam com `.env`. Ele foi feito para
proteger o `.env`, que tem senhas, mas acaba ignorando também o `.env.example`, que não tem nada secreto.
*(Corrigido na Etapa 1, passo 5.)*

### Etapa 0, passo 2: governança com IA 🤖

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

### Etapa 1, passo 1: subir o PostgreSQL com Docker 🤖

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

### Etapa 1, passo 3: conectar o Node ao Postgres 🤖

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

### Etapa 1, passo 4: adaptar as rotas do `server.js` 🤖

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
