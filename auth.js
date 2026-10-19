const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET nao definida. Veja o .env.example.');
}

// Cria o token ("cracha") que o navegador guarda depois do login.
// Dentro dele vai so o id e o nome do usuario (o token NAO e secreto, so assinado).
function createToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Middleware: roda ANTES das rotas protegidas.
// Se o pedido nao tiver um token valido, responde 401 e a rota nem chega a executar.
// Se tiver, coloca os dados do usuario em req.user para a rota usar.
function requireAuth(req, res, next) {
  // O navegador manda o token no cabecalho:  Authorization: Bearer <token>
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');

  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Faca login para acessar' });
  }

  try {
    // verify confere a assinatura e a validade. Se o token foi alterado ou expirou, lanca erro.
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Sessao invalida ou expirada. Faca login de novo' });
  }
}

module.exports = { createToken, requireAuth };
