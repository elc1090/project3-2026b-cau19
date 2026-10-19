# Debugging: deploy na Vercel dando "Cannot GET /"

Registro de um problema real que apareceu na Fase 3 (deploy) do projeto: depois de subir pra Vercel, a
página inicial dava 404 (`Cannot GET /`), mesmo com o projeto rodando perfeitamente local. Documentado
aqui porque foi o pedaço de debugging mais substancial do projeto — bom material pra explicar processo e
decisões na apresentação.

## TL;DR

- **Sintoma**: `https://project2-2026b-cau19.vercel.app/` retornava 404, mas o banco (Supabase) e o resto
  do código funcionavam perfeitamente local.
- **Causa raiz**: `express.static('public')` usa caminho relativo ao diretório de trabalho
  (`process.cwd()`), que na Vercel (ambiente serverless) não é garantidamente a raiz do projeto — então o
  Express nunca achava a pasta `public/` e servia 404 pra qualquer rota que não fosse `/api/*`.
- **Solução**: trocar para caminho absoluto ancorado em `__dirname`:
  `express.static(path.join(__dirname, 'public'))`.
- **Como cheguei nisso**: comparando os *headers* HTTP da rota que funcionava (`/api/scores`) com a que
  não funcionava (`/`) — as duas tinham `X-Powered-By: Express`, o que provou que o problema estava
  *dentro* do código, não na configuração de roteamento da Vercel.

## Linha do tempo (o que foi tentado, e por que cada tentativa falhou)

O projeto usa Node.js + Express + Supabase. Localmente sempre funcionou (`npm start`). O problema só
aparecia depois do deploy.

### Tentativa 1 — `vercel.json` com uma função "crua"

```json
{
  "version": 2,
  "builds": [{ "src": "server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "server.js" }]
}
```

**Ideia**: tratar `server.js` como uma função Node que responde por tudo.
**Resultado**: `Cannot GET /` de novo.
**Por quê**: o build de uma função `@vercel/node` empacota só os arquivos que são importados via
`require`/`import`. A pasta `public/` é só *referenciada* em tempo de execução (dentro de
`express.static('public')`), então nunca foi rastreada e incluída no pacote da função — ela
simplesmente não existia no ambiente publicado.

### Tentativa 2 — separar API (função) de estático (`rewrites`)

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api" },
    { "source": "/", "destination": "/public/index.html" }
  ]
}
```

**Ideia**: função só para `/api/*`, e deixar a Vercel servir `public/` como estático nas demais rotas.
**Resultado**: a Vercel emitiu um aviso de build:

> Internal rewrites in backend framework projects now route requests using the rewritten destination
> path. This behavior was previously unsupported and may change which application route handles a
> request.

**Por quê**: com esse aviso, o rewrite `/api/:path*` → `/api` passou a entregar pro Express o caminho
*de destino* (`/api`), não o caminho original da requisição (`/api/scores`). A rota
`app.get('/api/scores', ...)` nunca batia.

### Tentativa 3 — remover `vercel.json` totalmente

**Ideia**: confiar 100% na detecção automática de framework da Vercel pro Express, sem nenhuma
configuração manual.
**Resultado**: tudo 404, inclusive `/api/scores`. E não existia mais nenhuma opção de "Framework Preset"
nas configurações do projeto no painel.
**Por quê**: sem uma pasta `api/`, a Vercel não tinha motivo nenhum pra criar uma função serverless — ela
tratou o projeto inteiro como um site estático puro, e nenhuma rota dinâmica funcionava.

### Tentativa 4 — trazer `api/[...path].js` de volta (sem `vercel.json`)

```js
// api/[...path].js
module.exports = require('../server.js');
```

**Ideia**: usar o mecanismo mais básico e antigo da Vercel — qualquer arquivo dentro de `api/` vira
função automaticamente, independente de detecção de framework. O nome com colchetes (`[...path]`) é a
convenção de "catch-all": essa função responde por qualquer sub-caminho de `/api/*`, recebendo o caminho
original sem reescrita nenhuma (porque não há `rewrites` envolvido).
**Resultado**: `/api/scores` passou a funcionar. `/` continuou dando `Cannot GET /`.
**A pista**: usando `curl -D -` pra ver os headers da resposta, os dois (o que funcionava e o que não
funcionava) tinham `X-Powered-By: Express`:

```
$ curl -s -D - -o /dev/null https://project2-2026b-cau19.vercel.app/
HTTP/1.1 404 Not Found
X-Powered-By: Express
...

$ curl -s -D - -o /dev/null https://project2-2026b-cau19.vercel.app/api/scores
HTTP/1.1 200 OK
X-Powered-By: Express
...
```

Isso foi o ponto de virada: se as duas respostas têm `X-Powered-By: Express`, a requisição para `/`
**estava chegando no Express** — não era mais um problema de roteamento da Vercel (isso já teria sido
resolvido), era o **próprio Express** decidindo que não tinha rota pra `/`. Ou seja, o 404 agora era do
Express, não da Vercel.

### Causa raiz encontrada

```js
// server.js (antes)
app.use(express.static('public'));
```

`'public'` é um caminho **relativo**. O Express resolve caminhos relativos a partir de
`process.cwd()` (o diretório de trabalho do processo) — e em uma função serverless da Vercel, isso não é
garantidamente a raiz do projeto. Sem achar a pasta, o middleware de arquivos estáticos simplesmente não
servia nada, e a requisição caía no handler de 404 padrão do Express.

### Fix

```js
// server.js (depois)
const path = require('path');
// ...
app.use(express.static(path.join(__dirname, 'public')));
```

`__dirname` é sempre o diretório do próprio arquivo `server.js`, não importa de onde o processo foi
iniciado — então o caminho resolve corretamente tanto local quanto na Vercel.

## Como validar sem depender só do navegador

Em vez de só recarregar a página e ver "ainda não funciona", testar direto por linha de comando deixa
claro qual camada está falhando (Vercel vs. aplicação):

```bash
curl -s -D - -o /dev/null https://project2-2026b-cau19.vercel.app/
```

- Sem `X-Powered-By: Express` no 404 → problema de roteamento da Vercel (função não existe, ou não bate
  o caminho).
- Com `X-Powered-By: Express` no 404 → o problema é dentro do próprio código Express.

Esse tipo de teste também foi usado pra confirmar, depois do fix, que **todas** as rotas relevantes
respondiam certo em produção:

```bash
curl -s -o /dev/null -w "GET /: %{http_code}\n" https://project2-2026b-cau19.vercel.app/
curl -s -o /dev/null -w "GET /style.css: %{http_code}\n" https://project2-2026b-cau19.vercel.app/style.css
curl -s -o /dev/null -w "GET /game.js: %{http_code}\n" https://project2-2026b-cau19.vercel.app/game.js
curl -s -o /dev/null -w "GET /api/scores: %{http_code}\n" https://project2-2026b-cau19.vercel.app/api/scores
```

## Lições pra apresentação

- **Caminhos relativos são uma armadilha em ambientes serverless.** Funcionam local (onde o `cwd` é
  previsível) e quebram silenciosamente em produção. `__dirname` (ou equivalente) é mais seguro sempre
  que o código pode rodar em ambientes diferentes.
- **Um erro genérico (404) pode ter causas completamente diferentes** — problema de roteamento da
  plataforma vs. problema dentro da própria aplicação. Comparar respostas que funcionam com as que não
  funcionam (mesmos headers? mesma origem do erro?) ajuda a isolar em qual camada procurar.
- **Mecanismos "zero-config" nem sempre são a opção mais previsível.** A convenção antiga e explícita da
  Vercel (pasta `api/` = função) acabou sendo mais confiável do que depender de detecção automática de
  framework, que teve efeitos colaterais inesperados com configuração manual.
- **Depurar direto por linha de comando (`curl`) é mais rápido que ficar recarregando o navegador**,
  porque dá pra inspecionar headers e status code exatos, sem cache do navegador atrapalhando.
