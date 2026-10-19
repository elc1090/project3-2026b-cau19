// ---- Elementos da pagina ----
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const currentScoreEl = document.getElementById('current-score');
const scoreForm = document.getElementById('score-form');
const playerNameInput = document.getElementById('player-name');
const skipButton = document.getElementById('skip-button');
const saveButton = document.getElementById('save-button');
const rankingList = document.getElementById('ranking-list');

const dinoSprite1 = new Image();
dinoSprite1.src = 'dino1.png';

const dinoSprite2 = new Image();
dinoSprite2.src = 'dino2.png';

const cactusSprite = new Image();
cactusSprite.src = 'cacto.png';


// ---- Constantes do jogo ----
const GROUND_Y = 160; // altura do "chao" dentro do canvas
const GRAVITY = 0.2;
const JUMP_FORCE = -5;
const LEG_SWAP_FRAMES = 8; // troca de sprite a cada 8 quadros (~7,5x por segundo a 60fps)
const GROUND_MARK_SPACING = 40; // distancia entre cada linha
const GROUND_MARK_WIDTH = 10;   // largura de cada linha


// velocidade dos obstaculos: comeca lenta e sobe aos poucos ate um teto,
// pra dar tempo do jogador se acostumar antes de ficar dificil
const INITIAL_SPEED = 1.5;
const MAX_SPEED = 10;
const SPEED_RAMP_FRAMES = 3800; // ~30s a 60fps ate atingir a velocidade maxima
const CLOUD_SPEED_FACTOR = 0.3; // nuvens andam a 30% da velocidade dos obstaculos
const CLOUD_SPAWN_INTERVAL = 200; // a cada quantos quadros nasce uma nuvem nova

// intervalo entre obstaculos tambem diminui com a velocidade, mas nunca
// fica curto demais (senao vira impossivel de reagir)
const INITIAL_SPAWN_INTERVAL = 110;
const MAX_SPAWN_INTERVAL = 100;

// ---- Estado do jogo ----
let state = 'idle'; // idle | playing | gameover
let dino = { x: 40, y: GROUND_Y - 20, width: 20, height: 20, velocityY: 0 };
let obstacles = [];
let frameCount = 0;
let framesSinceLastObstacle = 0;
let nextSpawnThreshold = INITIAL_SPAWN_INTERVAL;
let obstacleSpeed = INITIAL_SPEED;
let score = 0;
let groundOffset = 0;
let clouds = [];
let framesSinceLastCloud = 0;



function resetGame() {
  dino = { x: 40, y: GROUND_Y - 20, width: 20, height: 20, velocityY: 0 };
  obstacles = [];
  frameCount = 0;
  framesSinceLastObstacle = 0;
  nextSpawnThreshold = INITIAL_SPAWN_INTERVAL;
  obstacleSpeed = INITIAL_SPEED;
  clouds = [];
  for (let i = 0; i < 3; i++) {
    spawnCloud(Math.random() * canvas.width);
  }
  framesSinceLastCloud = 0;
  score = 0;
  groundOffset = 0;
  currentScoreEl.textContent = 'Score: 0';
}

function jump() {
  // So pode pular se estiver no chao (evita pulo duplo no ar)
  const onGround = dino.y >= GROUND_Y - dino.height;
  if (onGround) {
    dino.velocityY = JUMP_FORCE;
  }
}

function handleInput() {
  if (state === 'idle') {
    state = 'playing';
    startScreen.classList.add('hidden');
    requestAnimationFrame(loop);
  } else if (state === 'playing') {
    jump();
  }
  // se state === 'gameover', o input e tratado pelo formulario, nao aqui
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    handleInput();
  }
});
canvas.addEventListener('pointerdown', handleInput);

function spawnObstacle() {
  const height = 15 + Math.random() * 20;
  obstacles.push({
    x: canvas.width,
    y: GROUND_Y - height,
    width: 12,
    height,
  });
}

function spawnCloud(x = canvas.width) {
  const y = 20 + Math.random() * 60; // varia a altura no "ceu"
  const size1 = 12 + Math.random() * 43; // quadrado central: de 12 a 55
  const size2 = 6 + Math.random() * 22; // quadrado da direita: de 6 a 28
  const size3 = 6 + Math.random() * 22; // quadrado da esquerda: de 6 a 28
  clouds.push({ x, y, size1, size2, size3 });
}


function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function update() {
  frameCount++;

  // fisica do pulo: a cada frame a velocidade aumenta pela gravidade
  dino.velocityY += GRAVITY;
  dino.y += dino.velocityY;
  if (dino.y > GROUND_Y - dino.height) {
    dino.y = GROUND_Y - dino.height;
    dino.velocityY = 0;
  }

  // progressao de dificuldade: velocidade sobe aos poucos ate o teto
  const ramp = Math.min(frameCount / SPEED_RAMP_FRAMES, 1);
  obstacleSpeed = INITIAL_SPEED + ramp * (MAX_SPEED - INITIAL_SPEED);
  groundOffset = (groundOffset + obstacleSpeed) % GROUND_MARK_SPACING;

  const meanSpawnInterval =
  INITIAL_SPAWN_INTERVAL + ramp * (MAX_SPAWN_INTERVAL - INITIAL_SPAWN_INTERVAL);

framesSinceLastObstacle++;
if (framesSinceLastObstacle >= nextSpawnThreshold) {
  spawnObstacle();
  framesSinceLastObstacle = 0;
  // sorteia o proximo alvo entre 70% e 130% da media atual
  const randomFactor = 0.7 + Math.random() * 0.6;
  nextSpawnThreshold = meanSpawnInterval * randomFactor;
}

  // move obstaculos e remove os que sairam da tela
  obstacles.forEach((o) => (o.x -= obstacleSpeed));
  obstacles = obstacles.filter((o) => o.x + o.width > 0);

  // nuvens: nascem, andam mais devagar (parallax) e somem da tela
  framesSinceLastCloud++;
  if (framesSinceLastCloud >= CLOUD_SPAWN_INTERVAL) {
    spawnCloud();
    framesSinceLastCloud = 0;
  }
  clouds.forEach((c) => (c.x -= obstacleSpeed * CLOUD_SPEED_FACTOR));
  clouds = clouds.filter((c) => c.x + c.size1 > 0);

  // colisao encerra o jogo
  for (const o of obstacles) {
    if (rectsOverlap(dino, o)) {
      endGame();
      return;
    }
  }

  // score sobe com o tempo sobrevivido
  score = Math.floor(frameCount / 6);
  currentScoreEl.textContent = `Score: ${score}`;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // nuvens (desenhadas primeiro = ficam atras de tudo, no "fundo")
  ctx.fillStyle = '#ddd';
  clouds.forEach((c) => {
    ctx.fillRect(c.x - c.size1 / 2, c.y - c.size1 / 2, c.size1, c.size1);
    ctx.fillRect(c.x + c.size1 * 0.5 - c.size2 / 2, c.y - c.size2 / 2, c.size2, c.size2);
    ctx.fillRect(c.x - c.size1 * 0.5 - c.size3 / 2, c.y - c.size3 / 2, c.size3, c.size3);
  });

  // chao
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(canvas.width, GROUND_Y);
  ctx.stroke();

  // linhas do chao (dao a sensacao de velocidade)
  ctx.fillStyle = '#8a8a8a';
  for (let x = -groundOffset; x < canvas.width; x += GROUND_MARK_SPACING) {
    ctx.fillRect(x, GROUND_Y + 4, GROUND_MARK_WIDTH, 2);
  }

  // dino (alterna entre os 2 sprites pra simular animacao de correr)
  const currentSprite = Math.floor(frameCount / LEG_SWAP_FRAMES) % 2 === 0 ? dinoSprite1 : dinoSprite2;
  ctx.drawImage(currentSprite, dino.x, dino.y, dino.width, dino.height);

  // obstaculos
  obstacles.forEach((o) => ctx.drawImage(cactusSprite, o.x, o.y, o.width, o.height));
}

function loop() {
  if (state !== 'playing') return;
  update();
  draw();
  if (state === 'playing') {
    requestAnimationFrame(loop);
  }
}

function endGame() {
  state = 'gameover';
  finalScoreEl.textContent = score;
  gameOverScreen.classList.remove('hidden');
  saveButton.disabled = false;
}

function backToStart() {
  gameOverScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
  state = 'idle';
  resetGame();
  draw();
}

// ---- Envio de score e ranking ----
scoreForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = playerNameInput.value.trim();
  if (!name) return;

  saveButton.disabled = true;

  await fetch('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score }),
  });

  playerNameInput.value = '';
  backToStart();
  await loadRanking();
});

skipButton.addEventListener('click', () => {
  playerNameInput.value = '';
  backToStart();
});


async function loadRanking() {
  const res = await fetch('/api/scores');
  const scores = await res.json();

  rankingList.innerHTML = '';
  scores.forEach((s) => {
    const li = document.createElement('li');
    li.textContent = `${s.name} - ${s.score}`;
    rankingList.appendChild(li);
  });
}

// ---- Inicializacao ----
resetGame();
draw();
loadRanking();
