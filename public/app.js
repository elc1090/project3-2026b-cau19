// ============================================================
// APP: abas, ranking, meus scores, medalhas, loja e fim de partida
// ============================================================
// As abas protegidas ("Meus scores" e "Medalhas") NAO sao escondidas de quem
// nao esta logado: elas sempre pedem os dados ao servidor. Sem login, o servidor
// responde 401 e mostramos o aviso de acesso negado. Isso deixa visivel que a
// protecao esta no backend, e nao so na tela.

// Evita que textos vindos do servidor virem HTML (protecao contra XSS)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const MEDAL_ICONS = { 1: '🥇', 2: '🥈', 3: '🥉' };
let skinsCatalog = []; // lista de skins vinda de GET /api/skins

function skinColorOf(skinId) {
  return skinsCatalog.find((s) => s.id === skinId)?.color || '#535353';
}

// Cor de "bolinha" para mostrar a skin em listas
function skinDotStyle(color) {
  if (color === 'rainbow') return 'background: linear-gradient(90deg, #e53, #fc3, #3c6, #39f, #a3f)';
  if (color === 'ghost') return 'background: #7f9cc4; opacity: .6';
  return `background: ${color}`;
}

// Aviso mostrado quando o SERVIDOR recusa o acesso
function lockedHtml(error) {
  return `
    <div class="locked">
      <p class="locked-icon">🔒</p>
      <p><strong>Acesso negado pelo servidor</strong> <code>HTTP ${error.status}</code></p>
      <p class="muted">${escapeHtml(error.message)}</p>
      <button type="button" class="btn btn-primary" data-action="login">Entrar ou cadastrar</button>
    </div>`;
}

function errorHtml(error) {
  return `<p class="error">Erro: ${escapeHtml(error.message)}</p>`;
}

// Qualquer botao com data-action="login" abre a janela de login
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="login"]')) openAuthDialog();
});

// ============================================================
// ABAS
// ============================================================
const tabButtons = document.querySelectorAll('.tab');
let activeTab = 'play';

function showTab(name) {
  activeTab = name;
  tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.id !== `tab-${name}`));

  if (name !== 'play') pauseGame();
  if (name === 'ranking') loadRanking();
  if (name === 'my-scores') loadMyScores();
  if (name === 'medals') loadMedals();
  if (name === 'shop') loadShop();
}

tabButtons.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

// ============================================================
// RANKING GLOBAL (publico)
// ============================================================
const rankingContent = document.getElementById('ranking-content');

async function loadRanking() {
  rankingContent.innerHTML = '<p class="muted">Carregando...</p>';
  try {
    const scores = await api('/api/scores');
    if (scores.length === 0) {
      rankingContent.innerHTML = '<p class="muted">Ninguém pontuou ainda. Seja o primeiro!</p>';
      return;
    }
    rankingContent.innerHTML = `
      <ol class="ranking-list">
        ${scores
          .map((s, i) => {
            const isMe = currentUser && s.username === currentUser.username;
            return `
              <li class="${isMe ? 'me' : ''}">
                <span class="rank">${MEDAL_ICONS[i + 1] || `${i + 1}º`}</span>
                <span class="skin-dot" style="${skinDotStyle(skinColorOf(s.selected_skin))}"></span>
                <span class="name">${escapeHtml(s.username)}${isMe ? ' <em>(você)</em>' : ''}</span>
                <span class="points">${s.score}</span>
              </li>`;
          })
          .join('')}
      </ol>`;
  } catch (error) {
    rankingContent.innerHTML = errorHtml(error);
  }
}

// ============================================================
// MEUS SCORES (protegido: GET /api/me/scores e DELETE /api/scores/:id)
// ============================================================
const myScoresContent = document.getElementById('my-scores-content');

async function loadMyScores() {
  myScoresContent.innerHTML = '<p class="muted">Carregando...</p>';
  try {
    const scores = await api('/api/me/scores');
    const best = scores.reduce((max, s) => Math.max(max, s.score), 0);

    myScoresContent.innerHTML = `
      <div class="stats">
        <div><span>${scores.length}</span>partidas</div>
        <div><span>${best}</span>recorde</div>
        <div><span>${currentUser ? currentUser.credits : 0}</span>créditos</div>
      </div>
      ${
        scores.length === 0
          ? '<p class="muted">Você ainda não tem scores salvos. Jogue uma partida!</p>'
          : `<table class="scores-table">
              <thead><tr><th>Data</th><th>Score</th><th>Moedas</th><th></th></tr></thead>
              <tbody>
                ${scores
                  .map(
                    (s) => `
                  <tr>
                    <td>${formatDate(s.created_at)}</td>
                    <td><strong>${s.score}</strong>${s.score === best ? ' 🏆' : ''}</td>
                    <td>${s.coins}</td>
                    <td><button type="button" class="btn btn-small btn-danger" data-delete="${s.id}">Apagar</button></td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
            <p class="muted small">Apagar um score não devolve os créditos ganhos com ele.</p>`
      }`;
  } catch (error) {
    myScoresContent.innerHTML = error.status === 401 ? lockedHtml(error) : errorHtml(error);
  }
}

myScoresContent.addEventListener('click', async (e) => {
  const button = e.target.closest('[data-delete]');
  if (!button) return;
  if (!confirm('Apagar este score? Ele sai do ranking e das medalhas.')) return;

  button.disabled = true;
  try {
    await api(`/api/scores/${button.dataset.delete}`, { method: 'DELETE' });
    await refreshUser(); // atualiza o recorde e recarrega a aba aberta (esta)
  } catch (error) {
    alert(error.message);
    button.disabled = false;
  }
});

// ============================================================
// MEDALHAS (protegido: GET /api/medals)
// ============================================================
const medalsContent = document.getElementById('medals-content');

function periodLabel(period) {
  // period vem como '2026-10' (mes) ou '2026' (ano)
  if (period.length === 4) return period;
  const [year, month] = period.split('-').map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function currentPeriods() {
  // mes e ano atuais no horario de Brasilia, no mesmo formato do servidor
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' })
    .formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year').value;
  const month = parts.find((p) => p.type === 'month').value;
  return { month: `${year}-${month}`, year };
}

// Agrupa as linhas por periodo: { '2026-10': [linhas], '2026-09': [...] }
function groupByPeriod(rows) {
  const groups = {};
  rows.forEach((r) => {
    (groups[r.period] = groups[r.period] || []).push(r);
  });
  return groups;
}

function podiumHtml(rows, current) {
  const groups = groupByPeriod(rows);
  const periods = Object.keys(groups);
  if (periods.length === 0) return '<p class="muted">Nenhuma medalha distribuída ainda.</p>';

  return periods
    .map(
      (period) => `
      <div class="podium">
        <h4>${periodLabel(period)} ${period === current ? '<span class="badge">em andamento</span>' : ''}</h4>
        <ol>
          ${groups[period]
            .map(
              (r) => `
            <li class="${r.is_me ? 'me' : ''}">
              <span>${MEDAL_ICONS[r.position]}</span>
              <span class="name">${escapeHtml(r.username)}${r.is_me ? ' <em>(você)</em>' : ''}</span>
              <span class="points">${r.best_score}</span>
            </li>`
            )
            .join('')}
        </ol>
      </div>`
    )
    .join('');
}

async function loadMedals() {
  medalsContent.innerHTML = '<p class="muted">Carregando...</p>';
  try {
    const { monthly, yearly } = await api('/api/medals');
    const current = currentPeriods();

    // Medalhas do proprio usuario
    const mine = [
      ...yearly.filter((r) => r.is_me).map((r) => ({ ...r, kind: 'anual' })),
      ...monthly.filter((r) => r.is_me).map((r) => ({ ...r, kind: 'mensal' })),
    ];
    const count = (pos) => mine.filter((m) => m.position === pos).length;

    medalsContent.innerHTML = `
      <h3>Minhas medalhas</h3>
      <div class="stats">
        <div><span>🥇 ${count(1)}</span>ouro</div>
        <div><span>🥈 ${count(2)}</span>prata</div>
        <div><span>🥉 ${count(3)}</span>bronze</div>
      </div>
      ${
        mine.length === 0
          ? '<p class="muted">Fique entre os 3 melhores do mês ou do ano para ganhar uma medalha.</p>'
          : `<ul class="my-medals">
              ${mine
                .map(
                  (m) => `<li>${MEDAL_ICONS[m.position]} ${periodLabel(m.period)} <span class="muted">(${m.kind}${
                    m.period === current.month || m.period === current.year ? ', em andamento' : ''
                  })</span></li>`
                )
                .join('')}
            </ul>`
      }
      <p class="muted small">Medalhas de períodos em andamento ainda podem mudar até o fim do mês/ano.</p>
      <h3>Campeões do ano</h3>
      <div class="podiums">${podiumHtml(yearly, current.year)}</div>
      <h3>Campeões do mês</h3>
      <div class="podiums">${podiumHtml(monthly, current.month)}</div>`;
  } catch (error) {
    medalsContent.innerHTML = error.status === 401 ? lockedHtml(error) : errorHtml(error);
  }
}

// ============================================================
// LOJA DE SKINS (catalogo publico; comprar e equipar sao protegidos)
// ============================================================
const shopContent = document.getElementById('shop-content');

async function loadSkinsCatalog() {
  try {
    skinsCatalog = await api('/api/skins');
  } catch (e) {
    skinsCatalog = [];
  }
}

async function loadShop() {
  if (skinsCatalog.length === 0) await loadSkinsCatalog();

  const owned = currentUser ? currentUser.owned_skins : [];
  const selected = currentUser ? currentUser.selected_skin : 'classico';
  const credits = currentUser ? currentUser.credits : 0;

  shopContent.innerHTML = `
    <p class="muted">
      ${currentUser
        ? `Você tem <strong>💰 ${credits}</strong> créditos. Ganhe mais jogando: 1 crédito a cada 10 pontos e 5 por moeda.`
        : 'Entre na sua conta para comprar e usar skins. Os créditos são ganhos jogando.'}
    </p>
    <div class="skins-grid">
      ${skinsCatalog
        .map((s) => {
          const isOwned = s.price === 0 || owned.includes(s.id);
          const isSelected = s.id === selected;
          let button;
          if (!currentUser) {
            // Sem login o botao tenta comprar mesmo assim: o servidor responde 401
            button = `<button type="button" class="btn" data-buy="${s.id}">${s.price === 0 ? 'Grátis' : `💰 ${s.price}`}</button>`;
          } else if (isSelected) {
            button = '<button type="button" class="btn" disabled>Em uso ✓</button>';
          } else if (isOwned) {
            button = `<button type="button" class="btn btn-primary" data-equip="${s.id}">Usar</button>`;
          } else if (credits < s.price) {
            button = `<button type="button" class="btn" disabled>Faltam ${s.price - credits}</button>`;
          } else {
            button = `<button type="button" class="btn btn-primary" data-buy="${s.id}">Comprar 💰 ${s.price}</button>`;
          }
          return `
            <div class="skin-card ${isSelected ? 'selected' : ''}">
              <canvas width="96" height="96" data-preview="${s.color}"></canvas>
              <strong>${escapeHtml(s.name)}</strong>
              <span class="muted small">${s.price === 0 ? 'grátis' : `${s.price} créditos`}</span>
              ${button}
            </div>`;
        })
        .join('')}
    </div>
    <p id="shop-message" class="small"></p>`;

  shopContent.querySelectorAll('[data-preview]').forEach((c) => drawSkinPreview(c, c.dataset.preview));
}

shopContent.addEventListener('click', async (e) => {
  const buyButton = e.target.closest('[data-buy]');
  const equipButton = e.target.closest('[data-equip]');
  const message = document.getElementById('shop-message');

  try {
    if (buyButton) {
      buyButton.disabled = true;
      await api(`/api/skins/${buyButton.dataset.buy}/buy`, { method: 'POST' });
      await api('/api/me/skin', { method: 'PUT', body: { skinId: buyButton.dataset.buy } });
      await refreshUser(); // atualiza creditos/skin e recarrega a loja
    } else if (equipButton) {
      equipButton.disabled = true;
      await api('/api/me/skin', { method: 'PUT', body: { skinId: equipButton.dataset.equip } });
      await refreshUser(); // atualiza a skin e recarrega a loja
    }
  } catch (error) {
    if (error.status === 401) {
      openAuthDialog(`O servidor recusou a compra (HTTP 401): ${error.message}.`);
    } else {
      message.textContent = error.message;
      message.className = 'small error';
    }
    if (buyButton) buyButton.disabled = false;
    if (equipButton) equipButton.disabled = false;
  }
});

// ============================================================
// FIM DE PARTIDA (chamado pelo game.js)
// ============================================================
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const finalCoinsEl = document.getElementById('final-coins');
const newRecordEl = document.getElementById('new-record');
const saveStatus = document.getElementById('save-status');
const loginToSaveButton = document.getElementById('login-to-save');
let pendingResult = null; // partida de quem jogou sem login, esperando para ser salva

async function handleGameOver(result) {
  finalScoreEl.textContent = result.score;
  finalCoinsEl.textContent = result.coins;
  const previousBest = currentUser ? currentUser.best_score : 0;
  newRecordEl.hidden = !(currentUser && result.score > previousBest && result.score > 0);
  gameOverScreen.classList.remove('hidden');

  if (currentUser) {
    loginToSaveButton.hidden = true;
    await saveResult(result);
  } else {
    pendingResult = result;
    saveStatus.textContent = 'Entre ou cadastre-se para salvar este score e ganhar créditos.';
    saveStatus.className = 'muted';
    loginToSaveButton.hidden = false;
  }
}

async function saveResult(result) {
  saveStatus.textContent = 'Salvando...';
  saveStatus.className = 'muted';
  try {
    const data = await api('/api/scores', { method: 'POST', body: result });
    saveStatus.textContent = `✓ Score salvo! +${data.creditsEarned} créditos`;
    saveStatus.className = 'success';
    await refreshUser();
  } catch (error) {
    saveStatus.textContent = `Não foi possível salvar: ${error.message}`;
    saveStatus.className = 'error';
    if (error.status === 401) {
      pendingResult = result;
      loginToSaveButton.hidden = false;
    }
  }
}

loginToSaveButton.addEventListener('click', () => openAuthDialog('Entre para salvar o score desta partida.'));
document.getElementById('restart-button').addEventListener('click', () => {
  pendingResult = null;
  restartGame();
});

// Chamado pelo auth.js depois de um login/cadastro com sucesso
async function onLoggedIn() {
  // Se havia uma partida esperando, salva agora
  if (pendingResult && !gameOverScreen.classList.contains('hidden')) {
    loginToSaveButton.hidden = true;
    const result = pendingResult;
    pendingResult = null;
    await saveResult(result);
  }
}

// Chamado pelo auth.js sempre que entra/sai da conta ou os dados mudam
function onUserChanged() {
  setSkin(currentUser ? skinColorOf(currentUser.selected_skin) : '#535353');
  setBestScore(currentUser ? currentUser.best_score : 0);
  // Recarrega a aba aberta, para refletir o novo estado (ex: depois do logout, mostra o 401)
  if (activeTab !== 'play') showTab(activeTab);
}

// ============================================================
// INICIO
// ============================================================
(async function init() {
  await loadSkinsCatalog();
  await refreshUser();
})();
