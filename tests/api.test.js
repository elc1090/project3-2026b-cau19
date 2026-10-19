// Testes da API: acessos PERMITIDOS e NAO PERMITIDOS.
// Usa so o que ja vem no Node (node:test, assert e fetch), sem bibliotecas extras.
//
// Como rodar (com o servidor ligado em outro terminal):
//   npm test
// Para testar o site publicado no Render:
//   $env:BASE_URL="https://SEU-APP.onrender.com"; npm test     (PowerShell)
const test = require('node:test');
const assert = require('node:assert');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// Faz um pedido para a API e devolve { status, body }
async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// Nomes unicos a cada execucao, para os testes poderem rodar varias vezes
const suffix = Date.now().toString().slice(-6);
const alice = { username: `alice_${suffix}`, password: 'senha123' };
const bob = { username: `bob_${suffix}`, password: 'senha456' };
let aliceToken;
let bobToken;
let aliceScoreId;

test('cadastro: cria usuario e devolve token', async () => {
  const res = await api('/api/register', { method: 'POST', body: alice });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.token);
  aliceToken = res.body.token;

  const res2 = await api('/api/register', { method: 'POST', body: bob });
  bobToken = res2.body.token;
});

test('cadastro: nome repetido e recusado (409)', async () => {
  const res = await api('/api/register', { method: 'POST', body: alice });
  assert.strictEqual(res.status, 409);
});

test('cadastro: senha curta e recusada (400)', async () => {
  const res = await api('/api/register', { method: 'POST', body: { username: `x_${suffix}`, password: '123' } });
  assert.strictEqual(res.status, 400);
});

test('login: senha certa devolve token', async () => {
  const res = await api('/api/login', { method: 'POST', body: alice });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.token);
});

test('login: senha errada e recusada (401)', async () => {
  const res = await api('/api/login', { method: 'POST', body: { ...alice, password: 'errada' } });
  assert.strictEqual(res.status, 401);
});

test('NAO PERMITIDO: rotas protegidas sem token respondem 401', async () => {
  const protectedRoutes = [
    ['GET', '/api/me'],
    ['GET', '/api/me/scores'],
    ['GET', '/api/medals'],
    ['POST', '/api/scores'],
    ['DELETE', '/api/scores/1'],
    ['POST', '/api/skins/oceano/buy'],
    ['PUT', '/api/me/skin'],
  ];
  for (const [method, path] of protectedRoutes) {
    const res = await api(path, { method, body: method === 'GET' ? undefined : {} });
    assert.strictEqual(res.status, 401, `${method} ${path} deveria exigir login`);
  }
});

test('NAO PERMITIDO: token falsificado responde 401', async () => {
  // Troca a ultima letra da assinatura: o servidor percebe que o token foi alterado
  const lastChar = aliceToken.slice(-1) === 'a' ? 'b' : 'a';
  const fake = aliceToken.slice(0, -1) + lastChar;
  const res = await api('/api/me', { token: fake });
  assert.strictEqual(res.status, 401);
});

test('PERMITIDO: usuario logado salva score e ganha creditos', async () => {
  const res = await api('/api/scores', { method: 'POST', token: aliceToken, body: { score: 1500, coins: 10 } });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.creditsEarned, 150 + 10 * 5);
  aliceScoreId = res.body.score.id;
});

test('NAO PERMITIDO: moedas impossiveis para o score sao recusadas (400)', async () => {
  const res = await api('/api/scores', { method: 'POST', token: aliceToken, body: { score: 10, coins: 500 } });
  assert.strictEqual(res.status, 400);
});

test('PERMITIDO: usuario ve so os proprios scores', async () => {
  const res = await api('/api/me/scores', { token: bobToken });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.length, 0, 'Bob nao deveria ver o score da Alice');
});

test('NAO PERMITIDO: Bob nao consegue apagar o score da Alice (404)', async () => {
  const res = await api(`/api/scores/${aliceScoreId}`, { method: 'DELETE', token: bobToken });
  assert.strictEqual(res.status, 404);

  const check = await api('/api/me/scores', { token: aliceToken });
  assert.strictEqual(check.body.length, 1, 'O score da Alice deveria continuar existindo');
});

test('PERMITIDO: usuario logado ve as medalhas', async () => {
  const res = await api('/api/medals', { token: aliceToken });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.monthly.some((m) => m.username === alice.username && m.is_me));
});

test('NAO PERMITIDO: comprar skin sem creditos suficientes (400)', async () => {
  const res = await api('/api/skins/arco-iris/buy', { method: 'POST', token: aliceToken });
  assert.strictEqual(res.status, 400);
});

test('NAO PERMITIDO: equipar skin que nao comprou (403)', async () => {
  const res = await api('/api/me/skin', { method: 'PUT', token: aliceToken, body: { skinId: 'oceano' } });
  assert.strictEqual(res.status, 403);
});

test('PERMITIDO: comprar skin com creditos e equipar', async () => {
  const buy = await api('/api/skins/oceano/buy', { method: 'POST', token: aliceToken });
  assert.strictEqual(buy.status, 201);
  assert.strictEqual(buy.body.credits, 200 - 100);

  const again = await api('/api/skins/oceano/buy', { method: 'POST', token: aliceToken });
  assert.strictEqual(again.status, 409, 'Nao deveria comprar a mesma skin duas vezes');

  const equip = await api('/api/me/skin', { method: 'PUT', token: aliceToken, body: { skinId: 'oceano' } });
  assert.strictEqual(equip.status, 200);

  const me = await api('/api/me', { token: aliceToken });
  assert.strictEqual(me.body.selected_skin, 'oceano');
  assert.deepStrictEqual(me.body.owned_skins, ['oceano']);
});

test('PERMITIDO: dono apaga o proprio score (204)', async () => {
  const res = await api(`/api/scores/${aliceScoreId}`, { method: 'DELETE', token: aliceToken });
  assert.strictEqual(res.status, 204);
});
