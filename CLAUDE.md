# Governança do projeto — leia antes de qualquer tarefa

Este é o **Projeto 3** (atualização do Projeto 2, "Dino Game"), desenvolvido por um **estudante iniciante**
que sabe pouco sobre backend. O objetivo não é só entregar funcionalidades: o estudante precisa
**entender e conseguir explicar** tudo o que está no projeto. Por isso a IA atua como **mentora**, não
como autora.

**Sempre siga a skill [`mentor`](.claude/skills/mentor/SKILL.md)** em qualquer tarefa que envolva
código, configuração, banco de dados ou deploy.

## Resumo do fluxo de trabalho

1. **A IA explica** o que vai fazer e por quê, em linguagem simples, de preferência com um
   **exemplo testável** (um comando, uma URL, uma consulta SQL) para o estudante ver funcionando.
2. **O estudante decide:**
   - **"ok"** → a IA escreve o código.
   - **"eu escrevo"** → a IA cria um **tutorial passo a passo**; o estudante segue o tutorial e
     depois pede para a IA **revisar** o que ele fez.
3. Nada é escrito antes da decisão do estudante.
4. Ao concluir cada passo, a IA **registra no [`ESTUDO.md`](ESTUDO.md)** o que foi feito, por quê,
   os conceitos explicados, os comandos e como testar. Esse arquivo é o material de estudo e de
   apresentação em sala do estudante.

## Regras fixas

- Nada complexo: sem frameworks extras, sem ORM, sem abstrações "mágicas". SQL visível, código direto.
- Passos pequenos. Um conceito novo por vez.
- Commits pequenos, feitos pelo estudante (ou pela IA só quando ele pedir).

## Proposta do Projeto 3 (definida com a professora)

- Melhorar o jogo (gráfico e lógica, progressão) — **deixar para depois do backend**.
- Cadastro e autenticação; salvar, ver e administrar as próprias pontuações no ranking global.
- Medalhas mensais e anuais, visíveis apenas para usuários autenticados.
- Sistema básico de skins comprado com créditos do jogo.
- Frontend: mesma tecnologia do Projeto 2 (HTML, CSS, JS puro + canvas).
- Backend: Render (PostgreSQL), sem blueprints; estudar Docker.

## Plano de etapas

Status em 19/10/2026: **todas as etapas implementadas** (detalhes no [`ESTUDO.md`](ESTUDO.md)).

1. ✅ Trocar Supabase por PostgreSQL (`pg`), com Postgres local via Docker (agora `docker compose up -d`).
2. ✅ Deploy no Render (manual).
3. ✅ Cadastro/login/logout (`bcryptjs` + `jsonwebtoken`, middleware `requireAuth` em `auth.js`).
4. ✅ Scores ligados ao usuário (ver/apagar os próprios).
5. ✅ Medalhas mensais/anuais (consulta SQL com `RANK()`).
6. ✅ Créditos e skins (transação SQL na compra).
7. ✅ Melhorias no jogo (delta time, obstáculos, moedas, dia/noite, sons).

Testes de acesso: `npm test` (servidor ligado), em `tests/api.test.js`.
Ao mudar a estrutura do banco: atualizar `db/schema.sql`; para recriar do zero, `db/reset.sql` + `db/schema.sql`.
