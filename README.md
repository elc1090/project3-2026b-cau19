# Projeto: Dino Game com persistência de dados em backend

![GIF do jogo em ação](./demo.gif "Demonstração do Dino Game")

## Acesso

**https://project2-2026b-cau19.vercel.app**

## Desenvolvedor(a)

Carlos Henrique Mendina Gonçalves Pereira — Engenharia de Computação

## Proposta

Jogo estilo "Dino Game": um personagem parado no canto esquerdo da tela desvia de obstáculos (pulando)
para sobreviver o maior tempo possível. Não há autenticação/login; o jogador apenas informa um nome ao
final da partida para entrar em uma tela de ranking com os maiores scores. O frontend se comunica com o
backend por meio de uma API (leitura e escrita), e os dados de ranking são persistidos do lado do
servidor.

Modalidade: **A** (parceria dev com Ricardo Facco Pigatto — comparação de decisões de código entre duas
implementações do mesmo "Dino Game").

## Parceria/cliente/usuário

Ricardo Facco Pigatto, autor da proposta original do "Dino Game" no documento de definições da
disciplina — também está desenvolvendo sua própria versão do jogo. Parceria de código (modalidade A):
comparar as decisões de implementação entre os dois projetos.

## Feedback/comentário da parceria/cliente/usuário

> A ser preenchido pelo Ricardo, com foco nas diferenças percebidas no código entre as duas
> implementações (modalidade A) — por exemplo, escolhas de stack, estrutura do backend, física do jogo,
> modelagem do banco de dados.

## Desenvolvimento

### Processo

Iniciei o projeto com pouca experiência prévia — apenas HTML e CSS soltos, sem contato com JavaScript —
e escolhi o Dino Game acreditando que seria fácil por causa do backend simples. A dificuldade real,
porém, esteve na lógica do jogo: minha maior virada de chave foi entender que o HTML/CSS criam a
estrutura prévia (como o `<canvas id="game-canvas">`) e o JavaScript apenas manipula esse elemento via
`document.getElementById`, quadro a quadro.

Para viabilizar o desenvolvimento, adaptei minha ideia inicial e trabalhei em conjunto com IA para
estruturar tutoriais, analisar código e resolver problemas mais complexos — como debugar um erro 404 na
Vercel, processo em que acompanhei e aprovei cada etapa. Ao mesmo tempo, mantive a mão na massa:
estruturei o HTML, ajustei manualmente a física do pulo e da gravidade, e escrevi trechos de código de
forma guiada.

Olhando para trás, hoje eu seguiria a dica da professora e escolheria algo como um formulário — a lógica
em tempo real do jogo pesou mais do que eu esperava. Ainda assim, o processo foi uma descoberta valiosa
e honesta sobre como construir e entender software.

### Trechos de código

**1. Física do pulo** — [game.js](./public/game.js)

```js
dino.velocityY += GRAVITY;
dino.y += dino.velocityY;
if (dino.y > GROUND_Y - dino.height) {
  dino.y = GROUND_Y - dino.height;
  dino.velocityY = 0;
}
```

Não existe nenhuma fórmula de parábola escrita à mão. A cada quadro, a gravidade é somada à velocidade
vertical, e a velocidade é somada à posição. O pulo (`JUMP_FORCE = -5`) só define uma velocidade inicial
negativa ("pra cima"); a gravidade puxa essa velocidade de volta pra positivo sozinha, quadro a quadro —
a curva de subida e descida do pulo emerge naturalmente desse laço, sem precisar calcular nenhuma
trajetória de antemão.

**2. Colisão por retângulos (AABB)** — [game.js](./public/game.js)

```js
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
```

Técnica *Axis-Aligned Bounding Box*: dois retângulos colidem se há sobreposição no eixo X **e** no eixo Y
ao mesmo tempo — se estiverem separados em qualquer um dos dois eixos, não colidem. É por isso que dá
pra desviar pulando: o pulo muda a posição Y bem na hora certa pra "escapar" da sobreposição, mesmo
estando na mesma posição X do obstáculo.

**3. Uso do Canvas para montar o jogo** — [game.js](./public/game.js)

```js
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
```

```js
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // nuvens, chao, dino, obstaculos — cada um desenhado na ordem de "fundo pra frente"
}
```

`canvas` é só um retângulo em branco no HTML, sem nenhum desenho embutido. `ctx` (contexto de desenho) é
o objeto obtido a partir dele que efetivamente sabe desenhar — retângulos (`fillRect`), imagens
(`drawImage`), linhas (`stroke`). O jogo inteiro é uma sequência de "fotografias" desenhadas do zero a
cada quadro: `clearRect` apaga o desenho anterior, e cada elemento é redesenhado na ordem certa (fundo
primeiro, personagem por último), sempre nas posições recém-calculadas por `update()`. É a repetição
disso ~60 vezes por segundo, via `requestAnimationFrame`, que cria a sensação de movimento contínuo a
partir de imagens estáticas.

## Tecnologias

### Linguagens e afins

- JavaScript (frontend com HTML5 Canvas, e backend com Node.js)
- HTML5 e CSS3
- Node.js + Express (servidor web e API REST)
- Supabase / PostgreSQL (`@supabase/supabase-js`) — banco de dados real, em uso atualmente
- Row Level Security (RLS) no Postgres, com policies restringindo a chave pública a apenas
  leitura e inserção de scores (sem update/delete)
- Deploy: Vercel (função serverless em `api/[...path].js` reexportando o app Express)

### Ambiente de desenvolvimento

- VS Code
- Claude Code (assistente de IA, usado para montar a estrutura inicial do projeto e o tutorial de
  desenvolvimento — o código e o processo de aprendizado foram revisados e explicados por mim)
- Node.js / npm
- Git e GitHub

## Referências e créditos

- [Documentação do Express](https://expressjs.com/pt-br/)
- [MDN — Canvas API](https://developer.mozilla.org/pt-BR/docs/Web/API/Canvas_API)
- [Documentação do Supabase](https://supabase.com/docs)
- [Documentação do supabase-js](https://supabase.com/docs/reference/javascript/introduction)
- [Documentação de Row Level Security do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Google Fonts — Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) (fonte pixelada
  usada no título e no HUD)
- Ideia original do "Dino Game" proposta por Ricardo Facco Pigatto no documento de definições da
  disciplina.

---
Projeto entregue para a disciplina de [Desenvolvimento de Software para a Web](http://github.com/andreainfufsm/elc1090-2026b) em 2026b
