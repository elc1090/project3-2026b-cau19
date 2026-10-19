const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('./database');
const { createToken, requireAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serve os arquivos do jogo (HTML, CSS, JS, imagens) da pasta public.
// __dirname = pasta onde este arquivo esta, assim o caminho funciona de qualquer lugar.
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// CADASTRO E LOGIN (rotas publicas)
// ============================================================

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/; // letras, numeros e _, de 3 a 20 caracteres

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  if (typeof username !== 'string' || !USERNAME_REGEX.test(username)) {
    return res.status(400).json({ error: 'Usuario deve ter de 3 a 20 letras, numeros ou _' });
  }
  // bcrypt so considera os primeiros 72 bytes da senha, por isso o limite
  if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
    return res.status(400).json({ error: 'Senha deve ter de 6 a 72 caracteres' });
  }

  try {
    // Gera o hash da senha. O 10 e o "custo": quantas rodadas de embaralhamento.
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, hash]
    );
    const user = result.rows[0];
    // Ja devolve o token: o usuario fica logado logo apos o cadastro
    res.status(201).json({ token: createToken(user), username: user.username });
  } catch (error) {
    // 23505 = codigo do Postgres para "violou o unique" (nome ja existe)
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Esse nome de usuario ja existe' });
    }
    console.error(error);
    res.status(500).json({ error: 'Erro ao cadastrar' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Informe usuario e senha' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    // bcrypt.compare embaralha a senha digitada do mesmo jeito e compara com o hash salvo.
    // A mensagem e a mesma para "usuario nao existe" e "senha errada": assim quem tenta
    // invadir nao descobre quais nomes de usuario existem.
    const passwordOk = user && (await bcrypt.compare(password, user.password_hash));
    if (!passwordOk) {
      return res.status(401).json({ error: 'Usuario ou senha incorretos' });
    }

    res.json({ token: createToken(user), username: user.username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Logout: com JWT o servidor nao guarda sessao, entao o logout e o navegador
// apagar o token (veja public/auth.js). Sem token, as rotas protegidas respondem 401.

// ============================================================
// RANKING GLOBAL E CATALOGO DE SKINS (rotas publicas)
// ============================================================

// Top 10: o MELHOR score de cada jogador
app.get('/api/scores', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.username, u.selected_skin, MAX(s.score) AS score
      FROM scores s
      JOIN users u ON u.id = s.user_id
      GROUP BY u.id
      ORDER BY score DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar o ranking' });
  }
});

app.get('/api/skins', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM skins ORDER BY price');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar as skins' });
  }
});

// ============================================================
// ROTAS PROTEGIDAS: requireAuth roda antes e barra quem nao tem token valido.
// O id do usuario vem SEMPRE do token (req.user.id), nunca do que o navegador envia,
// assim ninguem consegue agir em nome de outra pessoa.
// ============================================================

// Dados do usuario logado
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, credits, selected_skin,
              (SELECT COALESCE(MAX(score), 0) FROM scores WHERE user_id = users.id) AS best_score
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Usuario nao encontrado. Faca login de novo' });
    }

    const owned = await pool.query('SELECT skin_id FROM user_skins WHERE user_id = $1', [req.user.id]);
    user.owned_skins = owned.rows.map((row) => row.skin_id);
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar seus dados' });
  }
});

// Salvar um score (so logado). Tambem da creditos ao jogador.
app.post('/api/scores', requireAuth, async (req, res) => {
  const { score, coins = 0 } = req.body;

  if (!Number.isInteger(score) || score < 0 || score > 1000000) {
    return res.status(400).json({ error: 'Score invalido' });
  }
  // Limite simples contra trapaca: as moedas aparecem com frequencia limitada,
  // entao nao da para ter muito mais moedas do que o score permite.
  if (!Number.isInteger(coins) || coins < 0 || coins > Math.floor(score / 20) + 3) {
    return res.status(400).json({ error: 'Quantidade de moedas invalida' });
  }

  const creditsEarned = Math.floor(score / 10) + coins * 5;

  // TRANSACAO: salvar o score e somar os creditos tem que acontecer juntos.
  // Se der erro no meio, o ROLLBACK desfaz tudo (nao fica score sem credito nem o contrario).
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      'INSERT INTO scores (user_id, score, coins) VALUES ($1, $2, $3) RETURNING id, score, coins, created_at',
      [req.user.id, score, coins]
    );
    const updated = await client.query(
      'UPDATE users SET credits = credits + $1 WHERE id = $2 RETURNING credits',
      [creditsEarned, req.user.id]
    );
    await client.query('COMMIT');

    res.status(201).json({
      score: inserted.rows[0],
      creditsEarned,
      credits: updated.rows[0].credits,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Erro ao salvar o score' });
  } finally {
    client.release(); // devolve a conexao para o pool
  }
});

// Lista os scores do proprio usuario
app.get('/api/me/scores', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, score, coins, created_at FROM scores WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar seus scores' });
  }
});

// Apaga um score. AUTORIZACAO: o "AND user_id = $2" garante que so o dono consegue apagar.
// Se alguem tentar apagar o score de outra pessoa, nenhuma linha e afetada e responde 404.
app.delete('/api/scores/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM scores WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Score nao encontrado entre os seus' });
    }
    res.status(204).end(); // 204 = deu certo, sem conteudo para devolver
  } catch (error) {
    // id que nao e numero (ex: /api/scores/abc) faz o Postgres reclamar do tipo
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Id invalido' });
    }
    console.error(error);
    res.status(500).json({ error: 'Erro ao apagar o score' });
  }
});

// Medalhas: top 3 de cada mes e de cada ano (calculado na hora, direto do SQL).
// $1 e o formato do periodo: 'YYYY-MM' agrupa por mes, 'YYYY' agrupa por ano.
// O horario e convertido para o fuso de Brasilia antes de decidir o mes.
const MEDALS_SQL = `
  WITH best AS (
    SELECT to_char(s.created_at AT TIME ZONE 'America/Sao_Paulo', $1) AS period,
           u.id AS user_id, u.username, MAX(s.score) AS best_score
    FROM scores s
    JOIN users u ON u.id = s.user_id
    GROUP BY period, u.id
  ),
  ranked AS (
    SELECT *, RANK() OVER (PARTITION BY period ORDER BY best_score DESC)::int AS position
    FROM best
  )
  SELECT period, username, best_score, position, (user_id = $2) AS is_me
  FROM ranked
  WHERE position <= 3
  ORDER BY period DESC, position
`;

app.get('/api/medals', requireAuth, async (req, res) => {
  try {
    const monthly = await pool.query(MEDALS_SQL, ['YYYY-MM', req.user.id]);
    const yearly = await pool.query(MEDALS_SQL, ['YYYY', req.user.id]);
    res.json({ monthly: monthly.rows, yearly: yearly.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar as medalhas' });
  }
});

// Comprar uma skin com creditos
app.post('/api/skins/:id/buy', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const skinResult = await client.query('SELECT * FROM skins WHERE id = $1', [req.params.id]);
    const skin = skinResult.rows[0];
    if (!skin) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Skin nao existe' });
    }

    // FOR UPDATE "trava" a linha do usuario ate o fim da transacao: se dois pedidos de compra
    // chegarem ao mesmo tempo, o segundo espera o primeiro terminar (nao gasta o saldo duas vezes).
    const userResult = await client.query('SELECT credits FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    const owned = await client.query(
      'SELECT 1 FROM user_skins WHERE user_id = $1 AND skin_id = $2',
      [req.user.id, skin.id]
    );

    if (skin.price === 0 || owned.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Voce ja tem essa skin' });
    }
    if (userResult.rows[0].credits < skin.price) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Creditos insuficientes' });
    }

    const updated = await client.query(
      'UPDATE users SET credits = credits - $1 WHERE id = $2 RETURNING credits',
      [skin.price, req.user.id]
    );
    await client.query('INSERT INTO user_skins (user_id, skin_id) VALUES ($1, $2)', [req.user.id, skin.id]);
    await client.query('COMMIT');

    res.status(201).json({ credits: updated.rows[0].credits });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Erro ao comprar a skin' });
  } finally {
    client.release();
  }
});

// Escolher a skin em uso. AUTORIZACAO: so pode equipar skin gratis ou comprada.
app.put('/api/me/skin', requireAuth, async (req, res) => {
  const { skinId } = req.body;
  try {
    const allowed = await pool.query(
      `SELECT 1 FROM skins s
       WHERE s.id = $1
         AND (s.price = 0 OR EXISTS (SELECT 1 FROM user_skins WHERE user_id = $2 AND skin_id = s.id))`,
      [skinId, req.user.id]
    );
    if (allowed.rowCount === 0) {
      return res.status(403).json({ error: 'Voce nao tem essa skin' });
    }

    await pool.query('UPDATE users SET selected_skin = $1 WHERE id = $2', [skinId, req.user.id]);
    res.json({ selected_skin: skinId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao trocar a skin' });
  }
});

// Se o corpo do pedido nao for um JSON valido, responde com JSON (e nao com uma pagina de erro)
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalido' });
  }
  console.error(error);
  res.status(500).json({ error: 'Erro interno' });
});

app.listen(PORT, (error) => {
  if (error) throw error;   // ex.: porta ocupada (EADDRINUSE)
  console.log(`Servidor rodando na porta ${PORT}`);
});
