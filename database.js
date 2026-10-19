require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL nao definida. Copie .env.example para .env e preencha.');
}

// Pool = conjunto de conexoes com o banco, reaproveitadas pelo servidor
// O banco local (Docker) nao usa SSL; o banco do Render exige conexao criptografada
const isLocal = process.env.DATABASE_URL.includes('localhost');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

module.exports = pool;
