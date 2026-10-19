-- Estrutura completa do banco do Dino Game.
-- Pode ser rodado varias vezes sem erro (if not exists / on conflict).
--
-- Como os dados se relacionam:
--   users 1 ── N scores       (cada score pertence a um usuario)
--   users N ── N skins        (atraves de user_skins: quais skins cada usuario comprou)
--   users N ── 1 skins        (selected_skin: a skin que o usuario esta usando)

-- Catalogo de skins (cores do dino). Criada primeiro porque users aponta para ela.
create table if not exists skins (
  id text primary key,                         -- ex: 'oceano' (usado no codigo)
  name text not null,                          -- nome mostrado na loja
  price integer not null check (price >= 0),   -- preco em creditos
  color text not null                          -- cor usada para pintar o dino ('#rrggbb', 'ghost' ou 'rainbow')
);

-- Skins disponiveis. "on conflict do update" permite mudar precos rodando o arquivo de novo.
insert into skins (id, name, price, color) values
  ('classico',   'Clássico',   0,    '#535353'),
  ('oceano',     'Oceano',     100,  '#2b7bd6'),
  ('floresta',   'Floresta',   250,  '#2e9e4f'),
  ('lava',       'Lava',       250,  '#e0482f'),
  ('dourado',    'Dourado',    600,  '#d4a017'),
  ('fantasma',   'Fantasma',   1000, 'ghost'),
  ('arco-iris',  'Arco-íris',  2000, 'rainbow')
on conflict (id) do update
  set name = excluded.name, price = excluded.price, color = excluded.color;

-- Usuarios. A senha NUNCA e guardada: so o hash gerado pelo bcrypt.
create table if not exists users (
  id bigint generated always as identity primary key,
  username text not null unique,                             -- unique: nomes nao se repetem
  password_hash text not null,
  credits integer not null default 0 check (credits >= 0),   -- check: o banco recusa saldo negativo
  selected_skin text not null default 'classico' references skins(id),
  created_at timestamptz not null default now()
);

-- Pontuacoes. Cada uma pertence a um usuario (user_id).
-- "on delete cascade": se o usuario for apagado, os scores dele somem junto.
create table if not exists scores (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  score integer not null check (score >= 0),
  coins integer not null default 0 check (coins >= 0),
  created_at timestamptz not null default now()
);

-- Indice: deixa rapido buscar "os scores do usuario X"
create index if not exists scores_user_id_idx on scores (user_id);

-- Skins compradas por cada usuario (tabela de ligacao N para N).
-- A chave primaria dupla impede comprar a mesma skin duas vezes.
create table if not exists user_skins (
  user_id bigint not null references users(id) on delete cascade,
  skin_id text not null references skins(id),
  purchased_at timestamptz not null default now(),
  primary key (user_id, skin_id)
);
