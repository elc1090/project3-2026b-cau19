-- Tabela de ranking do Dino Game
create table if not exists scores (
  id bigint generated always as identity primary key,
  name text not null,
  score integer not null,
  created_at timestamptz not null default now()
);
