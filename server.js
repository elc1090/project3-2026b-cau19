const path = require('path');
const express = require('express');
const pool = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serve os arquivos do jogo (HTML, CSS, JS, imagens) da pasta public.
// __dirname = pasta onde este arquivo esta, assim o caminho funciona de qualquer lugar.
app.use(express.static(path.join(__dirname, 'public')));

// Retorna o top 10 do ranking, do maior score para o menor
app.get('/api/scores', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT name, score, created_at FROM scores ORDER BY score DESC LIMIT 10'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar o ranking' });
  }
});

// Recebe um novo score e salva no banco
app.post('/api/scores', async (req, res) => {
  const { name, score } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Nome invalido' });
  }
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return res.status(400).json({ error: 'Score invalido' });
  }

  try {
    // $1 e $2 sao substituidos pelos valores do array, com seguranca
    // (o pg trata esses valores como dados, nunca como comandos SQL)
    const result = await pool.query(
      'INSERT INTO scores (name, score) VALUES ($1, $2) RETURNING *',
      [name.trim().slice(0, 20), Math.floor(score)]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao salvar o score' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
