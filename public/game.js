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
const ACCELERATION = 6;        // px/s a mais a cada segundo, SEM limite (fica cada vez mais rapido)
const MAX_STEP_MOVE = 15;      // px: maior deslocamento permitido num sub-passo (evita "atravessar" coisas)
const PIXELS_PER_POINT = 40;   // a cada 40 px percorridos, +1 ponto
const NIGHT_EVERY = 700;       // a cada 700 pontos alterna entre dia e noite
const COIN_CHANCE = 0.35;      // chance de aparecer moedas entre dois obstaculos

// ---- Poderes (itens que aparecem no caminho) ----
const POWER_CHANCE = 0.2;          // chance de aparecer um poder entre dois obstaculos
const POWER_MIN_SCORE = 60;        // antes disso, so moedas
const DOUBLE_JUMP_VELOCITY = -640; // o segundo pulo e um pouco mais fraco que o primeiro
const MAGNET_RADIUS = 260;         // px: distancia em que o ima puxa as moedas
const MAGNET_PULL = 900;           // px/s: velocidade com que a moeda vai ate o dino
const GUN_AMMO = 6;                // tiros por arma coletada
const BULLET_SPEED = 1100;         // px/s
const PORTAL_POINTS = 200;         // pontos que o portal da
const PORTAL_SAFE_TIME = 1.2;      // s de invencibilidade depois de atravessar o portal
const SLOW_FACTOR = 0.5;           // camera lenta: o mundo anda na metade da velocidade

// ---- Parede estilo Flappy Bird (nao mata: tira metade das moedas da rodada) ----
const WALL_MIN_SCORE = 200;
const WALL_W = 34;
const WALL_GAP = 120;              // altura da abertura entre o cano de cima e o de baixo

// Poderes com duracao (o portal e instantaneo, por isso nao esta aqui)
const POWERS = {
  double: { label: 'PULO DUPLO', color: '#3b82f6', duration: 12 },
  magnet: { label: 'ÍMÃ', color: '#e5484d', duration: 10 },
  gun: { label: 'TIRO! (F)', color: '#8b5cf6', duration: 15 },
  shield: { label: 'ESCUDO', color: '#06b6d4', duration: 20 },
  slow: { label: 'CÂMERA LENTA', color: '#f59e0b', duration: 6 },
};
const PORTAL_COLOR = '#a855f7';

// ---- Tamanhos do dino ----
const DINO_X = 60;
const DINO_W = 44;
const DINO_H = 47;
const DUCK_W = 58;
const DUCK_H = 28;

// ---- Cores (dia e noite) ----
// skyTop/sky: degrade do ceu (de cima ate o horizonte); far/near: montanhas e dunas do fundo
const DAY = {
  skyTop: [118, 196, 238], sky: [255, 226, 186], ink: [83, 83, 83], cloud: [255, 255, 255],
  far: [178, 186, 222], near: [238, 196, 138], sand: [246, 214, 160], cactus: [58, 138, 62],
};
const NIGHT = {
  skyTop: [10, 10, 36], sky: [58, 38, 96], ink: [214, 214, 214], cloud: [58, 60, 104],
  far: [40, 36, 84], near: [66, 48, 104], sand: [44, 36, 76], cactus: [104, 186, 110],
};

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
  cactusDay = tintImage(images.cactus, rgb(DAY.cactus));
  cactusNight = tintImage(images.cactus, rgb(NIGHT.cactus));
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
let powerUps;       // poderes no chao/no ar esperando ser pegos
let bullets;
let active;         // tempo restante (s) de cada poder: { double, magnet, gun }
let ammo;
let invincible;     // s de invencibilidade (depois do portal)
let portalFlash;    // s do clarao roxo do portal
let timeScale;      // 1 = normal, 0.5 = camera lenta (multiplica o dt do "mundo")

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
  dino = { bottom: GROUND_Y, vy: 0, onGround: true, ducking: false, usedDoubleJump: false };
  obstacles = [];
  coinsOnScreen = [];
  powerUps = [];
  bullets = [];
  active = { double: 0, magnet: 0, gun: 0, shield: 0, slow: 0 };
  timeScale = 1;
  ammo = 0;
  invincible = 0;
  portalFlash = 0;
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

  // Pulo duplo: no ar, com o poder ativo e sem ter usado o segundo pulo ainda.
  // (perto do chao nao conta: ai o aperto vira o "buffer" do proximo pulo normal)
  if (!dino.onGround && active.double > 0 && !dino.usedDoubleJump && dino.bottom < GROUND_Y - 15) {
    dino.vy = DOUBLE_JUMP_VELOCITY;
    dino.usedDoubleJump = true;
    spawnSparkles(DINO_X + DINO_W / 2, dino.bottom, POWERS.double.color);
    playSound('doubleJump');
    return;
  }

  jumpBuffer = JUMP_BUFFER_TIME; // "guarda" o pedido de pulo por um instante
}

// Altura de onde sai o tiro (a "boca" da arma, desenhada na frente do dino)
function muzzleY() {
  return dino.ducking ? dino.bottom - DUCK_H + 10 : dino.bottom - DINO_H + 20;
}

function shoot() {
  if (state !== 'playing' || active.gun <= 0 || ammo <= 0) return;
  bullets.push({ x: DINO_X + DINO_W, y: muzzleY() });
  ammo--;
  if (ammo === 0) active.gun = 0; // acabou a municao: acaba o poder
  playSound('shoot');
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
  } else if (e.code === 'KeyF' || e.code === 'KeyX') {
    if (!e.repeat) shoot();
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

// Botao de tiro (para celular): so aparece enquanto o poder de tiro esta ativo
const shootButton = document.getElementById('shoot-button');
shootButton.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  shoot();
});

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
  if (score >= 300 && active.gun > 0) types.push('bird', 'bird', 'bird'); // com arma, mais alvos
  if (score >= WALL_MIN_SCORE) types.push('wall');
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
  } else if (type === 'wall') {
    // Cano de cima + cano de baixo com uma abertura no ar (a altura da abertura varia).
    // Pulo curto demais bate embaixo; pulo alto demais bate em cima.
    const gapBottom = GROUND_Y - 40 - Math.random() * 30;
    obstacle = { type: 'wall', x: W, w: WALL_W, gapTop: gapBottom - WALL_GAP, gapBottom, broken: false };
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

  // No meio do espaco livre: as vezes um poder, senao as vezes uma fileira de moedas
  const middle = W + obstacle.width + gap / 2;
  const coinChance = active.magnet > 0 ? 0.85 : COIN_CHANCE; // com ima, chovem moedas
  if (score >= POWER_MIN_SCORE && powerUps.length === 0 && Math.random() < POWER_CHANCE) {
    spawnPowerUp(middle);
  } else if (Math.random() < coinChance) {
    const count = active.magnet > 0 ? 5 : 1 + Math.floor(Math.random() * 3);
    spawnCoinRow(middle, count);
  }
}

// O servidor recusa partidas com mais de (score / 20 + 3) moedas (anti-trapaca, no server.js).
// Por isso o jogo nunca cria mais moedas do que esse limite deixa: conta as que ja foram
// pegas e as que estao na tela.
function coinBudget() {
  return Math.floor(score / 20) + 3 - coins - coinsOnScreen.length;
}

function newCoin(x, y) {
  return { x, y, r: 9 };
}

// Fileira de moedas, todas na mesma altura
function spawnCoinRow(centerX, count) {
  const coinHeights = [GROUND_Y - 22, GROUND_Y - 75, GROUND_Y - 110];
  const y = coinHeights[Math.floor(Math.random() * coinHeights.length)];
  const amount = Math.min(count, coinBudget());
  for (let i = 0; i < amount; i++) {
    coinsOnScreen.push(newCoin(centerX + (i - (amount - 1) / 2) * 26, y));
  }
}

function spawnPowerUp(x) {
  // Cada tipo so entra no sorteio quando faz sentido
  const kinds = ['double', 'magnet', 'shield'];
  if (score >= 150) kinds.push('portal');
  if (score >= 200) kinds.push('slow'); // so faz sentido quando o jogo ja esta rapido
  if (score >= 300) kinds.push('gun', 'gun'); // so depois que os passaros aparecem

  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  if (kind === 'portal') {
    // Portal fica em pe no chao: para entrar, e so NAO pular
    powerUps.push({ kind, x, y: GROUND_Y - 34, w: 30, h: 64 });
  } else {
    // Itens flutuam: baixo (pega correndo) ou alto (precisa pular)
    const y = Math.random() < 0.5 ? GROUND_Y - 28 : GROUND_Y - 85;
    powerUps.push({ kind, x, y, w: 26, h: 26 });
  }
}

function obstacleWidth(o) {
  if (o.type === 'bird' || o.type === 'wall') return o.w;
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

function spawnSparkles(x, y, color = '#f5c518') {
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
      color,
    });
  }
}

// ============================================================
// EFEITOS DOS PODERES
// ============================================================

function collectPowerUp(p) {
  if (p.kind === 'portal') {
    usePortal();
    return;
  }
  const power = POWERS[p.kind];
  active[p.kind] = power.duration; // pegar de novo "recarrega" o tempo
  if (p.kind === 'gun') ammo = GUN_AMMO;
  spawnSparkles(p.x, p.y, power.color);
  floatingTexts.push({ text: power.label, x: p.x, y: p.y - 18, life: 1, color: power.color });
  playSound('powerup');
}

function usePortal() {
  // +200 pontos: a pontuacao vem da distancia, entao "avancamos" a distancia equivalente
  distance += PORTAL_POINTS * PIXELS_PER_POINT;
  score = Math.floor(distance / PIXELS_PER_POINT);

  // O dino "sai" num trecho novo da pista: some com o que estava na frente dele
  obstacles = [];
  bullets = [];
  nextObstacleIn = 450;
  invincible = PORTAL_SAFE_TIME;
  portalFlash = 0.5;
  floatingTexts.push({ text: `+${PORTAL_POINTS}`, x: DINO_X + 40, y: dino.bottom - 60, life: 1.2, color: PORTAL_COLOR });
  playSound('portal');
}

// O escudo absorve uma batida: estoura e deixa o dino invencivel por um instante
function breakShield(o) {
  active.shield = 0;
  invincible = 1;
  if (o.type === 'wall') o.broken = true;
  spawnSparkles(DINO_X + DINO_W / 2, dino.bottom - DINO_H / 2, POWERS.shield.color);
  floatingTexts.push({ text: 'ESCUDO!', x: DINO_X + 30, y: dino.bottom - 60, life: 0.9, color: POWERS.shield.color });
  shake = 0.15;
  playSound('shield');
}

// Bateu na parede: nao morre, mas perde metade das moedas da rodada (arredonda para cima)
function hitWall(o) {
  o.broken = true; // parede quebrada: o dino atravessa
  const lost = Math.ceil(coins / 2);
  coins -= lost;
  for (let i = 0; i < Math.min(lost, 12); i++) {
    spawnSparkles(DINO_X + DINO_W / 2, dino.bottom - DINO_H / 2); // moedas "voando" para fora
  }
  const text = lost > 0 ? `-${lost} MOEDAS` : 'BATEU!';
  floatingTexts.push({ text, x: DINO_X + 50, y: dino.bottom - 60, life: 1.2, color: '#e5484d' });
  shake = 0.25;
  playSound('wallHit');
}

// Passaro ou cacto atingido: explode e as moedas vao DIRETO para o saldo da partida
// (passaro vale mais porque e mais dificil de acertar)
function explodeTarget(o) {
  const cx = o.x + o.width / 2;
  const cy = o.type === 'bird' ? o.y + o.h / 2 : GROUND_Y - 25;
  const reward = o.type === 'bird' ? 5 : 3;
  const amount = Math.max(0, Math.min(reward, coinBudget()));
  coins += amount;

  for (let i = 0; i < amount; i++) spawnSparkles(cx, cy); // brilho dourado
  spawnDust(cx, cy, 10);
  floatingTexts.push({ text: 'BOOM!', x: cx, y: cy - 16, life: 0.8, color: POWERS.gun.color });
  if (amount > 0) floatingTexts.push({ text: `+${amount}`, x: cx, y: cy - 32, life: 1 });
  shake = 0.15;
  playSound('explode');
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
  if (o.type === 'wall') {
    return [
      { x: o.x + 2, y: -100, w: o.w - 4, h: o.gapTop + 100 },                     // cano de cima
      { x: o.x + 2, y: o.gapBottom, w: o.w - 4, h: GROUND_Y - o.gapBottom },      // cano de baixo
    ];
  }
  return o.parts.map((p) => ({ x: o.x + p.dx + 3, y: GROUND_Y - p.h + 3, w: p.w - 6, h: p.h - 3 }));
}

// ============================================================
// ATUALIZACAO (fisica e regras) - roda a cada quadro, recebendo dt
// ============================================================

function update(dt) {
  animTime += dt;

  // CAMERA LENTA: tudo que e do "mundo" (pista, obstaculos, moedas, pontos) usa worldDt.
  // O dino, os tiros e os cronometros usam o dt normal: o jogador fica com os reflexos de sempre.
  // A escala muda aos poucos (e nao de uma vez) para a desaceleracao ficar suave.
  const targetScale = active.slow > 0 ? SLOW_FACTOR : 1;
  timeScale += (targetScale - timeScale) * Math.min(1, dt * 6);
  const worldDt = dt * timeScale;

  // Velocidade sobe aos poucos ate o maximo
  speed += ACCELERATION * worldDt;
  distance += speed * worldDt;
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

  // "Teto": com o pulo duplo, o dino nao pode sair por cima da tela
  const ceiling = DINO_H + 6;
  if (dino.bottom < ceiling) {
    dino.bottom = ceiling;
    dino.vy = Math.max(dino.vy, 0);
  }

  if (dino.bottom >= GROUND_Y) {
    if (!dino.onGround) spawnDust(DINO_X + 15, GROUND_Y, 6); // poeira ao pousar
    dino.bottom = GROUND_Y;
    dino.vy = 0;
    dino.onGround = true;
    dino.usedDoubleJump = false; // pousou: o pulo duplo pode ser usado de novo
  }

  // ---- Tempo dos poderes ----
  for (const kind in active) active[kind] = Math.max(0, active[kind] - dt);
  if (active.gun === 0) ammo = 0;
  if (invincible > 0) invincible -= dt;

  // ---- Obstaculos ----
  nextObstacleIn -= speed * worldDt;
  if (nextObstacleIn <= 0) spawnObstacle();

  obstacles.forEach((o) => (o.x -= speed * worldDt));
  obstacles = obstacles.filter((o) => o.x + o.width > -10);

  // ---- Tiros ----
  bullets.forEach((b) => (b.x += BULLET_SPEED * dt));
  bullets = bullets.filter((b) => {
    const bulletBox = { x: b.x, y: b.y - 2, w: 10, h: 4 };
    for (const o of obstacles) {
      if (o.broken) continue; // parede quebrada nao segura tiro
      // Passaro: usa o retangulo inteiro (mais facil de acertar); cacto e parede: a caixa normal
      const boxes = o.type === 'bird' ? [{ x: o.x, y: o.y, w: o.w, h: o.h }] : obstacleBoxes(o);
      if (boxes.some((ob) => rectsOverlap(bulletBox, ob))) {
        if (o.type === 'wall') {
          spawnDust(b.x, b.y, 4); // parede segura o tiro
        } else {
          explodeTarget(o);
          obstacles = obstacles.filter((other) => other !== o);
        }
        return false; // o tiro some
      }
    }
    return b.x < W;
  });

  // ---- Moedas ----
  const box = dinoBox();
  const dinoCenterX = box.x + box.w / 2;
  const dinoCenterY = box.y + box.h / 2;
  coinsOnScreen.forEach((c) => {
    c.x -= speed * worldDt;

    // Ima: moedas perto o bastante andam em direcao ao dino
    if (active.magnet > 0) {
      const dx = dinoCenterX - c.x;
      const dy = dinoCenterY - c.y;
      const dist = Math.hypot(dx, dy);
      if (dist < MAGNET_RADIUS && dist > 1) {
        c.x += (dx / dist) * MAGNET_PULL * dt;
        c.y += (dy / dist) * MAGNET_PULL * dt;
      }
    }
  });
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

  // ---- Poderes ----
  powerUps.forEach((p) => (p.x -= speed * worldDt));
  powerUps = powerUps.filter((p) => {
    const powerBox = { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
    if (rectsOverlap(box, powerBox)) {
      collectPowerUp(p);
      return false;
    }
    return p.x + p.w > 0;
  });

  // ---- Nuvens (andam mais devagar: efeito de profundidade / parallax) ----
  clouds.forEach((c) => (c.x -= speed * 0.2 * worldDt));
  clouds = clouds.filter((c) => c.x + c.size * 2 > 0);
  if (clouds.length < 4 && Math.random() < dt * 0.5) spawnCloud();

  groundOffset = (groundOffset + speed * worldDt) % W;

  // ---- Colisao (invencivel logo depois do portal ou do escudo) ----
  if (invincible > 0) return;
  for (const o of obstacles) {
    if (o.broken) continue; // parede ja quebrada: da para atravessar
    if (obstacleBoxes(o).some((b) => rectsOverlap(box, b))) {
      if (active.shield > 0) breakShield(o);
      else if (o.type === 'wall') hitWall(o);
      else die();
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
  if (portalFlash > 0) portalFlash -= dt;

  // Botao de tiro do celular: visivel so com a arma ativa
  shootButton.classList.toggle('hidden', !(state === 'playing' && active.gun > 0));
  shootButton.textContent = `🔫 x${ammo}`;

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

  // Ceu em degrade: azul em cima e alaranjado no horizonte (de noite: azul-escuro e roxo)
  const skyTop = mix(DAY.skyTop, NIGHT.skyTop, night);
  const skyBottom = mix(DAY.sky, NIGHT.sky, night);
  const gradient = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  gradient.addColorStop(0, rgb(skyTop));
  gradient.addColorStop(1, rgb(skyBottom));
  ctx.fillStyle = gradient;
  ctx.fillRect(-10, -10, W + 20, H + 20);

  // Sol (some aos poucos quando anoitece)
  if (night < 1) {
    ctx.globalAlpha = (1 - night) * 0.35;
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(130, 62, 34, 0, Math.PI * 2); // brilho em volta
    ctx.fill();
    ctx.globalAlpha = 1 - night;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(130, 62, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Estrelas e lua (so aparecem a noite)
  if (night > 0) {
    ctx.globalAlpha = night;
    ctx.fillStyle = rgb(NIGHT.ink);
    stars.forEach((s) => ctx.fillRect(s.x, s.y, s.size, s.size));
    ctx.beginPath();
    ctx.arc(680, 50, 16, 0, Math.PI * 2);
    ctx.fill();
    // circulo "por cima", com a cor do ceu naquela altura, faz a lua minguante
    ctx.fillStyle = rgb(mix(skyTop, skyBottom, 45 / GROUND_Y));
    ctx.beginPath();
    ctx.arc(688, 45, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Montanhas (longe, andam bem devagar) e dunas (mais perto, um pouco mais rapido): parallax
  drawHills(rgb(mix(DAY.far, NIGHT.far, night)), 0.04, 70, 140, false);
  drawHills(rgb(mix(DAY.near, NIGHT.near, night)), 0.12, 34, 230, true);

  // Nuvens (feitas de 3 retangulos, estilo pixel)
  ctx.fillStyle = rgb(mix(DAY.cloud, NIGHT.cloud, night));
  clouds.forEach((c) => {
    ctx.fillRect(c.x, c.y, c.size * 2, c.size * 0.6);
    ctx.fillRect(c.x + c.size * 0.4, c.y - c.size * 0.4, c.size * 1.1, c.size * 0.5);
  });

  // Chao de areia, linha do chao e pedrinhas
  ctx.fillStyle = rgb(mix(DAY.sand, NIGHT.sand, night));
  ctx.fillRect(-10, GROUND_Y, W + 20, H - GROUND_Y + 10);
  ctx.fillStyle = ink;
  ctx.fillRect(0, GROUND_Y, W, 2);
  ctx.globalAlpha = 0.45;
  pebbles.forEach((p) => {
    const x = (((p.x - groundOffset) % W) + W) % W;
    ctx.fillRect(x, p.y, p.w, 2);
  });
  ctx.globalAlpha = 1;

  drawPowerUps();
  drawCoins();
  drawObstacles();
  drawBullets();
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
  floatingTexts.forEach((t) => {
    ctx.fillStyle = t.color || '#d4a017';
    ctx.fillText(t.text, t.x, t.y);
  });

  // Camera lenta: tela levemente alaranjada (mais forte quanto mais lento)
  if (timeScale < 0.99) {
    ctx.globalAlpha = ((1 - timeScale) / (1 - SLOW_FACTOR)) * 0.12;
    ctx.fillStyle = POWERS.slow.color;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.globalAlpha = 1;
  }

  // Clarao roxo ao atravessar o portal
  if (portalFlash > 0) {
    ctx.globalAlpha = (portalFlash / 0.5) * 0.6;
    ctx.fillStyle = PORTAL_COLOR;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  drawHud(ink);
}

// Uma fileira de morros que se repete. "factor" = quanto do movimento da pista ela acompanha
// (0.04 = 4%: bem longe). A altura de cada morro vem de um seno do seu numero, entao o mesmo
// morro tem sempre a mesma altura, sem precisar guardar nada.
function drawHills(color, factor, height, width, rounded) {
  const scroll = distance * factor;
  const first = Math.floor(scroll / width);
  const shift = scroll % width;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-shift, GROUND_Y);
  for (let k = 0; k <= W / width + 1; k++) {
    const x = k * width - shift;
    const h = height * (0.55 + 0.45 * Math.abs(Math.sin((first + k) * 1.7)));
    if (rounded) {
      ctx.quadraticCurveTo(x + width / 2, GROUND_Y - h * 2, x + width, GROUND_Y); // duna redonda
    } else {
      ctx.lineTo(x + width / 2, GROUND_Y - h); // pico da montanha
      ctx.lineTo(x + width, GROUND_Y);
    }
  }
  ctx.closePath();
  ctx.fill();
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

// Desenha o simbolo de um poder num circulo colorido (usado no item e no placar)
function drawPowerIcon(kind, x, y, r) {
  ctx.fillStyle = POWERS[kind].color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, r * 0.22);
  const s = r * 0.45;
  if (kind === 'double') {
    // Duas setinhas para cima
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.moveTo(x - s, y + s);
    ctx.lineTo(x, y);
    ctx.lineTo(x + s, y + s);
    ctx.stroke();
  } else if (kind === 'magnet') {
    // Um "U" (formato de ima)
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI);
    ctx.moveTo(x - s, y);
    ctx.lineTo(x - s, y - s);
    ctx.moveTo(x + s, y);
    ctx.lineTo(x + s, y - s);
    ctx.stroke();
  } else if (kind === 'gun') {
    // Uma arminha: cano + cabo
    ctx.fillRect(x - s, y - s * 0.5, s * 2, s * 0.6);
    ctx.fillRect(x - s, y - s * 0.5, s * 0.6, s * 1.4);
  } else if (kind === 'shield') {
    // Formato de escudo
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.1);
    ctx.lineTo(x + s, y - s * 0.6);
    ctx.lineTo(x + s * 0.8, y + s * 0.4);
    ctx.lineTo(x, y + s * 1.1);
    ctx.lineTo(x - s * 0.8, y + s * 0.4);
    ctx.lineTo(x - s, y - s * 0.6);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'slow') {
    // Um relogio
    ctx.beginPath();
    ctx.arc(x, y, s * 1.1, 0, Math.PI * 2);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - s * 0.8);
    ctx.moveTo(x, y);
    ctx.lineTo(x + s * 0.6, y);
    ctx.stroke();
  }
}

function drawPortal(p) {
  // Varias elipses que "respiram" em tempos diferentes dao a ideia de redemoinho
  for (let i = 0; i < 4; i++) {
    const pulse = 0.75 + Math.sin(animTime * 6 + i * 1.5) * 0.25;
    ctx.globalAlpha = 0.35 + i * 0.15;
    ctx.fillStyle = i % 2 === 0 ? PORTAL_COLOR : '#3b0764';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, (p.w / 2) * pulse * (1 - i * 0.2), (p.h / 2) * (1 - i * 0.15), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = PORTAL_COLOR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPowerUps() {
  powerUps.forEach((p) => {
    if (p.kind === 'portal') {
      drawPortal(p);
      return;
    }
    const bob = Math.sin(animTime * 5) * 3;
    // Anel brilhando em volta, para chamar atencao
    ctx.globalAlpha = 0.3 + Math.sin(animTime * 8) * 0.15;
    ctx.fillStyle = POWERS[p.kind].color;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, p.w / 2 + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawPowerIcon(p.kind, p.x, p.y + bob, p.w / 2);
  });
}

function drawBullets() {
  ctx.fillStyle = POWERS.gun.color;
  bullets.forEach((b) => {
    ctx.globalAlpha = 0.35;
    ctx.fillRect(b.x - 14, b.y - 1, 14, 2); // rastro
    ctx.globalAlpha = 1;
    ctx.fillRect(b.x, b.y - 2, 10, 4);
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
    } else if (o.type === 'wall') {
      drawWall(o);
    } else {
      drawBird(o);
    }
  });
}

// Parede estilo Flappy Bird: dois canos verdes com "borda" na ponta
function drawWall(o) {
  ctx.globalAlpha = o.broken ? 0.25 : 1; // quebrada: fica apagadinha
  const pipes = [
    { y: -10, h: o.gapTop + 10, capY: o.gapTop - 10 },
    { y: o.gapBottom, h: GROUND_Y - o.gapBottom, capY: o.gapBottom },
  ];
  ctx.strokeStyle = '#2d6b19';
  ctx.lineWidth = 2;
  pipes.forEach((p) => {
    ctx.fillStyle = '#5bbf3a';
    ctx.fillRect(o.x, p.y, o.w, p.h);
    ctx.fillStyle = '#3e8f24';
    ctx.fillRect(o.x + o.w - 8, p.y, 8, p.h); // sombra
    ctx.fillStyle = '#8be06a';
    ctx.fillRect(o.x + 4, p.y, 5, p.h);       // brilho
    ctx.strokeRect(o.x, p.y, o.w, p.h);
    ctx.fillStyle = '#5bbf3a';
    ctx.fillRect(o.x - 4, p.capY, o.w + 8, 10);
    ctx.strokeRect(o.x - 4, p.capY, o.w + 8, 10);
  });
  ctx.globalAlpha = 1;
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

  // Ima ativo: um anel vermelho pulsando em volta do dino
  if (active.magnet > 0 && state !== 'idle') {
    ctx.strokeStyle = POWERS.magnet.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.25 + Math.sin(animTime * 10) * 0.15;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 34 + Math.sin(animTime * 10) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Escudo: bolha azul-clara em volta do dino
  if (active.shield > 0 && state !== 'idle') {
    ctx.fillStyle = POWERS.shield.color;
    ctx.strokeStyle = POWERS.shield.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 33, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.6 + Math.sin(animTime * 6) * 0.2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Pulo duplo disponivel: "asinhas" azuis nas costas
  if (active.double > 0 && !dino.usedDoubleJump && state !== 'idle') {
    ctx.fillStyle = POWERS.double.color;
    const flap = Math.floor(animTime * 8) % 2 === 0 ? 0 : 4;
    ctx.fillRect(x - 8, y + 14 - flap, 12, 5);
    ctx.fillRect(x - 12, y + 10 - flap, 8, 5);
  }

  // Invencivel (depois do portal): o dino pisca
  const blinking = invincible > 0 && Math.floor(animTime * 15) % 2 === 0;
  const baseAlpha = blinking ? 0.3 : 1;
  ctx.globalAlpha = baseAlpha;

  if (skin.type === 'classic') {
    ctx.globalAlpha = (1 - night) * baseAlpha;
    ctx.drawImage(skin.day[kind], x, y, w, h);
    ctx.globalAlpha = night * baseAlpha;
    ctx.drawImage(skin.night[kind], x, y, w, h);
  } else if (skin.type === 'rainbow') {
    const frame = skin.frames[Math.floor(animTime * 12) % skin.frames.length];
    ctx.drawImage(frame[kind], x, y, w, h);
  } else if (skin.type === 'ghost') {
    ctx.globalAlpha = (0.55 + Math.sin(animTime * 4) * 0.15) * baseAlpha;
    ctx.drawImage(skin.set[kind], x, y, w, h);
  } else {
    ctx.drawImage(skin.set[kind], x, y, w, h);
  }
  ctx.globalAlpha = 1;

  // Arma na "mao" do dino enquanto o tiro esta ativo
  if (active.gun > 0 && state !== 'idle') {
    ctx.fillStyle = POWERS.gun.color;
    ctx.fillRect(x + w - 8, muzzleY() - 3, 14, 6);
    ctx.fillRect(x + w - 6, muzzleY() + 2, 5, 6);
  }
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

  // Poderes ativos: icone + barra com o tempo que falta
  let rowY = 52;
  ctx.font = '8px "Press Start 2P", monospace';
  for (const kind in POWERS) {
    if (active[kind] <= 0) continue;
    const alpha = active[kind] < 2 && Math.floor(animTime * 8) % 2 === 0 ? 0.35 : 1; // pisca no fim
    ctx.globalAlpha = alpha;
    drawPowerIcon(kind, 24, rowY, 9);
    ctx.fillStyle = ink;
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillRect(38, rowY - 3, 60, 6);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = POWERS[kind].color;
    ctx.fillRect(38, rowY - 3, 60 * (active[kind] / POWERS[kind].duration), 6);
    if (kind === 'gun') {
      ctx.fillStyle = ink;
      ctx.fillText(`x${ammo}`, 104, rowY + 4);
    }
    ctx.globalAlpha = 1;
    rowY += 22;
  }
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
  if (name === 'doubleJump') {
    beep(620, 0.08);
    setTimeout(() => beep(880, 0.1), 50);
  }
  if (name === 'powerup') {
    [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => beep(f, 0.08, 'triangle', 0.06), i * 60));
  }
  if (name === 'shoot') beep(1500, 0.06, 'square', 0.03);
  if (name === 'explode') {
    beep(90, 0.3, 'sawtooth', 0.08);
    setTimeout(() => beep(1200, 0.08), 120);
  }
  if (name === 'shield') {
    beep(400, 0.1, 'triangle', 0.07);
    setTimeout(() => beep(250, 0.15, 'triangle', 0.07), 80);
  }
  if (name === 'wallHit') {
    beep(150, 0.25, 'square', 0.07);
    [900, 700, 500].forEach((f, i) => setTimeout(() => beep(f, 0.06), 100 + i * 70));
  }
  if (name === 'portal') {
    [300, 450, 600, 800, 1000, 1300].forEach((f, i) => setTimeout(() => beep(f, 0.1, 'sine', 0.07), i * 45));
  }
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

  // SUB-PASSOS: como a velocidade nao tem limite, num quadro um cacto (ou um tiro) poderia andar
  // mais do que a largura do dino e "atravessar" sem colidir. Entao dividimos o quadro em
  // pedacos menores, para nada andar mais que MAX_STEP_MOVE px de uma vez.
  if (state === 'playing') {
    const steps = Math.ceil(((speed + BULLET_SPEED) * dt) / MAX_STEP_MOVE);
    for (let i = 0; i < steps && state === 'playing'; i++) update(dt / steps);
  }
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
