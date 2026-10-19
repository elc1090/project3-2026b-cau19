// ============================================================
// DINO GAME: logica e desenho do jogo (canvas)
// ============================================================
//
// IMPORTANTE: tudo que se move usa "pixels POR SEGUNDO" e e multiplicado por dt
// (o tempo, em segundos, que passou desde o ultimo quadro). Assim o jogo tem a
// mesma velocidade num monitor de 60 Hz, 144 Hz ou 240 Hz:
//   - 60 Hz  -> dt ~ 0,0167 s -> anda 340 * 0,0167 = ~5,7 px por quadro
//   - 144 Hz -> dt ~ 0,0069 s -> anda 340 * 0,0069 = ~2,4 px por quadro
// Em 1 segundo, os dois andaram 340 px.

// ---- Elementos da pagina ----
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');

// ---- Tamanho logico do jogo (o desenho usa sempre essas medidas) ----
const W = 800;
const H = 250;
const GROUND_Y = 218;

// Ajusta a resolucao real do canvas a tela (fica nitido em telas de alta densidade)
const dpr = window.devicePixelRatio || 1;
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

// ---- Constantes de fisica (em pixels e segundos) ----
const GRAVITY = 2600;          // px/s²: quanto a velocidade vertical aumenta por segundo
const JUMP_VELOCITY = -820;    // px/s: velocidade inicial do pulo (negativo = para cima)
const JUMP_CUT_VELOCITY = -350; // soltar o botao cedo corta o pulo: pulo curto x pulo longo
const FAST_FALL_MULTIPLIER = 3; // abaixar no ar faz cair mais rapido
const JUMP_BUFFER_TIME = 0.12;  // s: apertar pouco antes de tocar o chao ainda conta como pulo
const MAX_DT = 1 / 30;          // limita o dt: se o navegador travar, o dino nao "teleporta"

// ---- Progressao de dificuldade ----
const START_SPEED = 340;       // px/s
const MAX_SPEED = 900;         // px/s
const ACCELERATION = 6;        // px/s a mais a cada segundo (~93 s ate a velocidade maxima)
const PIXELS_PER_POINT = 40;   // a cada 40 px percorridos, +1 ponto
const NIGHT_EVERY = 700;       // a cada 700 pontos alterna entre dia e noite
const COIN_CHANCE = 0.35;      // chance de aparecer uma moeda entre dois obstaculos

// ---- Tamanhos do dino ----
const DINO_X = 60;
const DINO_W = 44;
const DINO_H = 47;
const DUCK_W = 58;
const DUCK_H = 28;

// ---- Cores (dia e noite) ----
const DAY = { sky: [247, 247, 247], ink: [83, 83, 83], cloud: [226, 226, 226] };
const NIGHT = { sky: [27, 31, 43], ink: [214, 214, 214], cloud: [58, 64, 80] };

// ---- Imagens ----
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });
}
const images = {};
const imagesReady = Promise.all([
  loadImage('dino1.png').then((img) => (images.run1 = img)),
  loadImage('dino2.png').then((img) => (images.run2 = img)),
  loadImage('dinoparado.png').then((img) => (images.idle = img)),
  loadImage('cacto.png').then((img) => (images.cactus = img)),
]);

// ============================================================
// SKINS: pinta os sprites do dino com outra cor
// ============================================================

// Desenha a imagem num canvas separado e pinta todos os pixels visiveis com a cor.
// 'source-in' = a cor so aparece onde a imagem ja tinha pixel (o fundo continua transparente).
function tintImage(img, color) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);

  // Alguns sprites (ex: dinoparado.png) tem fundo BRANCO em vez de transparente.
  // Percorre os pixels (4 numeros cada: R, G, B, A) e deixa os quase brancos transparentes.
  const pixels = g.getImageData(0, 0, c.width, c.height);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) d[i + 3] = 0;
  }
  g.putImageData(pixels, 0, 0);

  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

function tintSet(color) {
  return {
    run1: tintImage(images.run1, color),
    run2: tintImage(images.run2, color),
    idle: tintImage(images.idle, color),
  };
}

// Monta os sprites de uma skin. Algumas sao especiais:
//  - classico: cinza de dia e claro de noite (acompanha o ciclo)
//  - ghost: azulada e meio transparente
//  - rainbow: 12 versoes com cores diferentes, trocadas com o tempo
function buildSkin(color) {
  if (color === 'rainbow') {
    const frames = [];
    for (let i = 0; i < 12; i++) frames.push(tintSet(`hsl(${i * 30}, 85%, 55%)`));
    return { type: 'rainbow', frames };
  }
  if (color === 'ghost') {
    return { type: 'ghost', set: tintSet('#7f9cc4') };
  }
  if (color === '#535353') {
    return { type: 'classic', day: tintSet(rgb(DAY.ink)), night: tintSet(rgb(NIGHT.ink)) };
  }
  return { type: 'solid', set: tintSet(color) };
}

let skin = null;
let skinColor = '#535353';
let cactusDay = null;
let cactusNight = null;

imagesReady.then(() => {
  skin = buildSkin(skinColor);
  cactusDay = tintImage(images.cactus, rgb(DAY.ink));
  cactusNight = tintImage(images.cactus, rgb(NIGHT.ink));
});

// Chamado pelo app.js quando o usuario escolhe/carrega uma skin
function setSkin(color) {
  skinColor = color || '#535353';
  imagesReady.then(() => (skin = buildSkin(skinColor)));
}

// Desenha um dino parado com a skin num canvas pequeno (usado na loja)
function drawSkinPreview(previewCanvas, color) {
  imagesReady.then(() => {
    const g = previewCanvas.getContext('2d');
    const built = buildSkin(color);
    let sprite;
    if (built.type === 'rainbow') sprite = built.frames[0].idle;
    else if (built.type === 'classic') sprite = built.day.idle;
    else sprite = built.set.idle;

    g.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    g.globalAlpha = built.type === 'ghost' ? 0.6 : 1;
    const size = Math.min(previewCanvas.width, previewCanvas.height) * 0.8;
    g.drawImage(sprite, (previewCanvas.width - size) / 2, (previewCanvas.height - size) / 2, size, size);
    g.globalAlpha = 1;
  });
}

// ============================================================
// ESTADO DO JOGO
// ============================================================
let state = 'idle'; // idle | playing | paused | gameover
let dino;
let obstacles;
let coinsOnScreen;
let clouds;
let particles;
let floatingTexts;
let speed;
let distance;
let score;
let coins;
let bestScore = 0;
let lastMilestone;
let scoreFlash;
let nextObstacleIn;
let groundOffset;
let night;          // 0 = dia, 1 = noite (valores no meio = transicao)
let shake;
let jumpBuffer;
let jumpHeld;
let duckHeld;
let animTime;
let gameOverAt = 0;

// Pedrinhas do chao e estrelas: sorteadas uma vez so
const pebbles = Array.from({ length: 40 }, () => ({
  x: Math.random() * W,
  y: GROUND_Y + 4 + Math.random() * 12,
  w: 2 + Math.random() * 4,
}));
const stars = Array.from({ length: 30 }, () => ({
  x: Math.random() * W,
  y: 10 + Math.random() * 120,
  size: Math.random() < 0.2 ? 2 : 1,
}));

function resetGame() {
  dino = { bottom: GROUND_Y, vy: 0, onGround: true, ducking: false };
  obstacles = [];
  coinsOnScreen = [];
  clouds = [];
  particles = [];
  floatingTexts = [];
  speed = START_SPEED;
  distance = 0;
  score = 0;
  coins = 0;
  lastMilestone = 0;
  scoreFlash = 0;
  nextObstacleIn = 500;
  groundOffset = 0;
  night = 0;
  shake = 0;
  jumpBuffer = 0;
  jumpHeld = false;
  animTime = 0;
  for (let i = 0; i < 4; i++) spawnCloud(Math.random() * W);
}

// ============================================================
// CONTROLES
// ============================================================

function startGame() {
  resetGame();
  state = 'playing';
  startScreen.classList.add('hidden');
  unlockAudio();
}

function pressJump() {
  if (state === 'idle') {
    startGame();
    return;
  }
  if (state !== 'playing') return;
  jumpHeld = true;
  jumpBuffer = JUMP_BUFFER_TIME; // "guarda" o pedido de pulo por um instante
}

function releaseJump() {
  jumpHeld = false;
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    pauseScreen.classList.remove('hidden');
  } else if (state === 'paused') {
    state = 'playing';
    pauseScreen.classList.add('hidden');
  }
}

function pauseGame() {
  if (state === 'playing') togglePause();
}

// O teclado so controla o jogo se a aba "Jogar" estiver aberta e o usuario
// nao estiver digitando num campo (ex: formulario de login)
function gameHasFocus() {
  const tag = document.activeElement?.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA';
  const dialogOpen = document.querySelector('dialog[open]');
  const playTabVisible = !document.getElementById('tab-play').hidden;
  return playTabVisible && !typing && !dialogOpen;
}

document.addEventListener('keydown', (e) => {
  if (!gameHasFocus()) return;

  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault(); // evita a pagina rolar com o espaco
    if (e.repeat) return;
    if (state === 'gameover') {
      // espera um pouquinho para nao reiniciar sem querer logo apos morrer
      if (performance.now() - gameOverAt > 700) restartGame();
      return;
    }
    pressJump();
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    duckHeld = true;
  } else if (e.code === 'KeyP' || e.code === 'Escape') {
    togglePause();
  } else if (e.code === 'KeyM') {
    toggleMute();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') releaseJump();
  if (e.code === 'ArrowDown' || e.code === 'KeyS') duckHeld = false;
});

// Toque/clique no jogo = pular (segurar = pulo mais alto)
const gameWrapper = document.getElementById('game-wrapper');
gameWrapper.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return; // botoes das telas tem a propria acao
  if (state === 'paused') {
    togglePause();
    return;
  }
  pressJump();
});
window.addEventListener('pointerup', releaseJump);

// Trocou de aba do navegador ou minimizou: pausa sozinho
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});

// ============================================================
// CRIACAO DE OBSTACULOS, MOEDAS E NUVENS
// ============================================================

function spawnObstacle() {
  // Os tipos mais dificeis so aparecem depois de certa pontuacao
  const types = ['small', 'small', 'large'];
  if (score >= 150) types.push('group', 'group');
  if (score >= 300) types.push('bird', 'bird');
  const type = types[Math.floor(Math.random() * types.length)];

  let obstacle;
  if (type === 'small') {
    obstacle = { type: 'cactus', x: W, parts: [{ dx: 0, w: 22, h: 42 }] };
  } else if (type === 'large') {
    obstacle = { type: 'cactus', x: W, parts: [{ dx: 0, w: 30, h: 58 }] };
  } else if (type === 'group') {
    const count = Math.random() < 0.5 ? 2 : 3;
    const parts = [];
    for (let i = 0; i < count; i++) {
      parts.push({ dx: i * 20, w: 22, h: 36 + Math.random() * 14 });
    }
    obstacle = { type: 'cactus', x: W, parts };
  } else {
    // Passaro em 3 alturas: baixo (pular), meio (abaixar ou pulo alto), alto (nao pular!)
    const heights = [GROUND_Y - 8, GROUND_Y - 38, GROUND_Y - 62];
    const bottom = heights[Math.floor(Math.random() * heights.length)];
    obstacle = { type: 'bird', x: W, y: bottom - 26, w: 40, h: 26 };
  }
  obstacle.width = obstacleWidth(obstacle);
  obstacles.push(obstacle);

  // Distancia ate o proximo obstaculo: cresce com a velocidade,
  // para sempre dar tempo de pousar e pular de novo
  const minGap = speed * 0.7 + 120;
  const gap = minGap + Math.random() * (speed * 0.9 + 200);
  nextObstacleIn = gap + obstacle.width;

  // As vezes coloca uma moeda no meio do espaco livre
  if (Math.random() < COIN_CHANCE) {
    const coinHeights = [GROUND_Y - 22, GROUND_Y - 75, GROUND_Y - 110];
    coinsOnScreen.push({
      x: W + obstacle.width + gap / 2,
      y: coinHeights[Math.floor(Math.random() * coinHeights.length)],
      r: 9,
    });
  }
}

function obstacleWidth(o) {
  if (o.type === 'bird') return o.w;
  const last = o.parts[o.parts.length - 1];
  return last.dx + last.w;
}

function spawnCloud(x = W) {
  clouds.push({ x, y: 25 + Math.random() * 80, size: 14 + Math.random() * 30 });
}

function spawnDust(x, y, amount) {
  for (let i = 0; i < amount; i++) {
    particles.push({
      x,
      y,
      vx: -60 - Math.random() * 120,
      vy: -40 - Math.random() * 80,
      life: 0.4,
      maxLife: 0.4,
      size: 2 + Math.random() * 2,
      color: 'ink',
    });
  }
}

function spawnSparkles(x, y) {
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * 140,
      vy: Math.sin(angle) * 140,
      life: 0.35,
      maxLife: 0.35,
      size: 3,
      color: '#f5c518',
    });
  }
}

// ============================================================
// COLISAO
// ============================================================

// Dois retangulos colidem se ha sobreposicao no eixo X E no eixo Y (AABB)
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// "Caixa de colisao" um pouco menor que o desenho: fica mais justo para o jogador,
// porque os cantos do sprite sao transparentes
function dinoBox() {
  const w = dino.ducking ? DUCK_W : DINO_W;
  const h = dino.ducking ? DUCK_H : DINO_H;
  return { x: DINO_X + 6, y: dino.bottom - h + 4, w: w - 12, h: h - 6 };
}

function obstacleBoxes(o) {
  if (o.type === 'bird') return [{ x: o.x + 4, y: o.y + 6, w: o.w - 8, h: o.h - 12 }];
  return o.parts.map((p) => ({ x: o.x + p.dx + 3, y: GROUND_Y - p.h + 3, w: p.w - 6, h: p.h - 3 }));
}

// ============================================================
// ATUALIZACAO (fisica e regras) - roda a cada quadro, recebendo dt
// ============================================================

function update(dt) {
  animTime += dt;

  // Velocidade sobe aos poucos ate o maximo
  speed = Math.min(MAX_SPEED, speed + ACCELERATION * dt);
  distance += speed * dt;
  score = Math.floor(distance / PIXELS_PER_POINT);

  // A cada 100 pontos o placar pisca e toca um som
  if (Math.floor(score / 100) > lastMilestone) {
    lastMilestone = Math.floor(score / 100);
    scoreFlash = 0.9;
    playSound('milestone');
  }

  // ---- Dino ----
  dino.ducking = duckHeld && dino.onGround;

  if (jumpBuffer > 0) jumpBuffer -= dt;
  if (jumpBuffer > 0 && dino.onGround) {
    dino.vy = JUMP_VELOCITY;
    dino.onGround = false;
    jumpBuffer = 0;
    playSound('jump');
  }
  // Soltou o botao enquanto ainda subia rapido: corta o pulo (pulo curto)
  if (!jumpHeld && dino.vy < JUMP_CUT_VELOCITY) {
    dino.vy = JUMP_CUT_VELOCITY;
  }

  // Gravidade: formula do movimento com aceleracao constante (fisica do ensino medio):
  //   posicao   += v*t + (1/2)*a*t²
  //   velocidade += a*t
  // Usar a formula exata faz o pulo ter a mesma altura com qualquer dt (qualquer monitor)
  const gravity = duckHeld && !dino.onGround ? GRAVITY * FAST_FALL_MULTIPLIER : GRAVITY;
  dino.bottom += dino.vy * dt + 0.5 * gravity * dt * dt;
  dino.vy += gravity * dt;

  if (dino.bottom >= GROUND_Y) {
    if (!dino.onGround) spawnDust(DINO_X + 15, GROUND_Y, 6); // poeira ao pousar
    dino.bottom = GROUND_Y;
    dino.vy = 0;
    dino.onGround = true;
  }

  // ---- Obstaculos ----
  nextObstacleIn -= speed * dt;
  if (nextObstacleIn <= 0) spawnObstacle();

  obstacles.forEach((o) => (o.x -= speed * dt));
  obstacles = obstacles.filter((o) => o.x + o.width > -10);

  // ---- Moedas ----
  coinsOnScreen.forEach((c) => (c.x -= speed * dt));
  const box = dinoBox();
  coinsOnScreen = coinsOnScreen.filter((c) => {
    const coinBox = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
    if (rectsOverlap(box, coinBox)) {
      coins++;
      spawnSparkles(c.x, c.y);
      floatingTexts.push({ text: '+1', x: c.x, y: c.y - 10, life: 0.7 });
      playSound('coin');
      return false; // remove a moeda coletada
    }
    return c.x + c.r > 0;
  });

  // ---- Nuvens (andam mais devagar: efeito de profundidade / parallax) ----
  clouds.forEach((c) => (c.x -= speed * 0.2 * dt));
  clouds = clouds.filter((c) => c.x + c.size * 2 > 0);
  if (clouds.length < 4 && Math.random() < dt * 0.5) spawnCloud();

  groundOffset = (groundOffset + speed * dt) % W;

  // ---- Colisao ----
  for (const o of obstacles) {
    if (obstacleBoxes(o).some((b) => rectsOverlap(box, b))) {
      die();
      return;
    }
  }
}

// Efeitos que continuam mesmo fora do "playing" (ex: tremida apos morrer)
function updateEffects(dt) {
  // Dia/noite: vai mudando aos poucos ate o alvo
  const target = Math.floor(score / NIGHT_EVERY) % 2;
  night += Math.sign(target - night) * Math.min(Math.abs(target - night), dt * 0.6);

  if (scoreFlash > 0) scoreFlash -= dt;
  if (shake > 0) shake -= dt;

  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 400 * dt;
    p.life -= dt;
  });
  particles = particles.filter((p) => p.life > 0);

  floatingTexts.forEach((t) => {
    t.y -= 40 * dt;
    t.life -= dt;
  });
  floatingTexts = floatingTexts.filter((t) => t.life > 0);
}

function die() {
  state = 'gameover';
  gameOverAt = performance.now();
  shake = 0.3;
  playSound('die');
  if (score > bestScore) bestScore = score;

  // Espera a tremida terminar e avisa o app.js (que mostra a tela e salva o score)
  const result = { score, coins };
  setTimeout(() => {
    if (typeof handleGameOver === 'function') handleGameOver(result);
  }, 450);
}

function restartGame() {
  document.getElementById('game-over-screen').classList.add('hidden');
  startGame();
}

// ============================================================
// DESENHO
// ============================================================

// Mistura duas cores: t = 0 -> cor a, t = 1 -> cor b
function mix(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}
function rgb(c) {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function draw() {
  const ink = rgb(mix(DAY.ink, NIGHT.ink, night));

  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6);

  // Ceu
  ctx.fillStyle = rgb(mix(DAY.sky, NIGHT.sky, night));
  ctx.fillRect(-10, -10, W + 20, H + 20);

  // Estrelas e lua (so aparecem a noite)
  if (night > 0) {
    ctx.globalAlpha = night;
    ctx.fillStyle = rgb(NIGHT.ink);
    stars.forEach((s) => ctx.fillRect(s.x, s.y, s.size, s.size));
    ctx.beginPath();
    ctx.arc(680, 50, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgb(NIGHT.sky);
    ctx.beginPath();
    ctx.arc(688, 45, 14, 0, Math.PI * 2); // circulo "por cima" faz a lua minguante
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Nuvens (feitas de 3 retangulos, estilo pixel)
  ctx.fillStyle = rgb(mix(DAY.cloud, NIGHT.cloud, night));
  clouds.forEach((c) => {
    ctx.fillRect(c.x, c.y, c.size * 2, c.size * 0.6);
    ctx.fillRect(c.x + c.size * 0.4, c.y - c.size * 0.4, c.size * 1.1, c.size * 0.5);
  });

  // Chao e pedrinhas
  ctx.fillStyle = ink;
  ctx.fillRect(0, GROUND_Y, W, 2);
  pebbles.forEach((p) => {
    const x = (((p.x - groundOffset) % W) + W) % W;
    ctx.fillRect(x, p.y, p.w, 2);
  });

  drawCoins();
  drawObstacles();
  drawDino();

  // Particulas
  particles.forEach((p) => {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color === 'ink' ? ink : p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  });
  ctx.globalAlpha = 1;

  // Textos flutuantes ("+1")
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d4a017';
  floatingTexts.forEach((t) => ctx.fillText(t.text, t.x, t.y));

  ctx.restore();
  drawHud(ink);
}

function drawCoins() {
  coinsOnScreen.forEach((c) => {
    const bob = Math.sin(animTime * 6 + c.x * 0.05) * 3; // moeda "flutua" para cima e para baixo
    const squash = Math.abs(Math.cos(animTime * 4)); // efeito de girar
    ctx.fillStyle = '#d4a017';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + bob, c.r * Math.max(squash, 0.25), c.r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f7d65a';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + bob, c.r * 0.55 * Math.max(squash, 0.25), c.r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawObstacles() {
  obstacles.forEach((o) => {
    if (o.type === 'cactus') {
      o.parts.forEach((p) => {
        const x = o.x + p.dx;
        const y = GROUND_Y - p.h;
        // Desenha a versao "dia" e a "noite" por cima, com transparencias opostas
        if (cactusDay) {
          ctx.globalAlpha = 1 - night;
          ctx.drawImage(cactusDay, x, y, p.w, p.h);
          ctx.globalAlpha = night;
          ctx.drawImage(cactusNight, x, y, p.w, p.h);
          ctx.globalAlpha = 1;
        }
      });
    } else {
      drawBird(o);
    }
  });
}

// Passaro desenhado com retangulos; as asas batem trocando de posicao
function drawBird(o) {
  ctx.fillStyle = rgb(mix(DAY.ink, NIGHT.ink, night));
  const wingUp = Math.floor(animTime * 8) % 2 === 0;
  const x = o.x;
  const y = o.y;
  ctx.fillRect(x + 8, y + 10, 26, 8);  // corpo
  ctx.fillRect(x + 2, y + 8, 10, 6);   // cabeca
  ctx.fillRect(x - 4, y + 11, 6, 3);   // bico
  ctx.fillRect(x + 34, y + 12, 6, 4);  // cauda
  if (wingUp) ctx.fillRect(x + 14, y, 10, 10);
  else ctx.fillRect(x + 14, y + 18, 10, 8);
}

function drawDino() {
  if (!skin) return;

  // Escolhe o sprite: parado, correndo (2 quadros alternando) ou abaixado
  let kind = 'idle';
  if (state === 'playing' || state === 'paused') {
    kind = dino.onGround ? (Math.floor(animTime * 10) % 2 === 0 ? 'run1' : 'run2') : 'idle';
  }

  const w = dino.ducking ? DUCK_W : DINO_W;
  const h = dino.ducking ? DUCK_H : DINO_H;
  const x = DINO_X;
  const y = dino.bottom - h;

  if (skin.type === 'classic') {
    ctx.globalAlpha = 1 - night;
    ctx.drawImage(skin.day[kind], x, y, w, h);
    ctx.globalAlpha = night;
    ctx.drawImage(skin.night[kind], x, y, w, h);
  } else if (skin.type === 'rainbow') {
    const frame = skin.frames[Math.floor(animTime * 12) % skin.frames.length];
    ctx.drawImage(frame[kind], x, y, w, h);
  } else if (skin.type === 'ghost') {
    ctx.globalAlpha = 0.55 + Math.sin(animTime * 4) * 0.15;
    ctx.drawImage(skin.set[kind], x, y, w, h);
  } else {
    ctx.drawImage(skin.set[kind], x, y, w, h);
  }
  ctx.globalAlpha = 1;
}

function pad(n) {
  return String(n).padStart(5, '0');
}

function drawHud(ink) {
  ctx.font = '14px "Press Start 2P", monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = ink;

  // Placar pisca a cada 100 pontos
  const hideScore = scoreFlash > 0 && Math.floor(scoreFlash * 6) % 2 === 0;
  const scoreText = hideScore ? '' : pad(score);
  ctx.globalAlpha = 0.6;
  ctx.fillText(`HI ${pad(Math.max(bestScore, score))}`, W - 110, 28);
  ctx.globalAlpha = 1;
  ctx.fillText(scoreText, W - 16, 28);

  // Moedas coletadas na partida
  ctx.textAlign = 'left';
  ctx.fillStyle = '#d4a017';
  ctx.beginPath();
  ctx.arc(24, 23, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.fillText(`x${coins}`, 38, 29);
}

// ============================================================
// SONS (gerados na hora com a Web Audio API, sem arquivos)
// ============================================================
let audioCtx = null;
let muted = false;
try {
  muted = localStorage.getItem('dino_muted') === '1';
} catch (e) {
  // localStorage pode estar bloqueado: segue com som ligado
}

function unlockAudio() {
  // O navegador so deixa tocar som depois de uma interacao do usuario
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch (e) {
      audioCtx = null;
    }
  }
}

function beep(freq, duration, type = 'square', volume = 0.05) {
  if (!audioCtx || muted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playSound(name) {
  if (name === 'jump') beep(520, 0.12);
  if (name === 'coin') {
    beep(880, 0.08);
    setTimeout(() => beep(1320, 0.12), 70);
  }
  if (name === 'milestone') beep(1000, 0.15, 'triangle');
  if (name === 'die') beep(120, 0.4, 'sawtooth', 0.08);
}

function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem('dino_muted', muted ? '1' : '0');
  } catch (e) {
    // sem localStorage: a preferencia so vale ate recarregar a pagina
  }
  document.getElementById('mute-button').textContent = muted ? '🔇' : '🔊';
}
document.getElementById('mute-button').textContent = muted ? '🔇' : '🔊';
document.getElementById('mute-button').addEventListener('click', toggleMute);

// ============================================================
// LACO PRINCIPAL
// ============================================================
// requestAnimationFrame chama "frame" a cada atualizacao do monitor, passando o horario atual.
// A diferenca para o quadro anterior e o dt.
let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, MAX_DT);
  lastTime = now;

  if (state === 'playing') update(dt);
  updateEffects(dt);
  draw();

  requestAnimationFrame(frame);
}

// Funcoes que o app.js usa
function setBestScore(n) {
  bestScore = Math.max(0, n || 0);
}

resetGame();
requestAnimationFrame(frame);
