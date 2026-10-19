// ============================================================
// AUTENTICACAO NO NAVEGADOR
// ============================================================
// Depois do login, o servidor devolve um token (JWT). Guardamos esse token no
// localStorage e mandamos ele no cabecalho "Authorization" de todo pedido.
// Quem decide se o pedido e permitido e SEMPRE o servidor: esconder botoes aqui
// e so conforto visual, nao seguranca.

const TOKEN_KEY = 'dino_token';
let currentUser = null; // dados do usuario logado (vem de GET /api/me), ou null

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

function saveToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    // sem localStorage o login vale so enquanto a pagina estiver aberta
  }
  memoryToken = token;
}

function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    // nada a fazer
  }
  memoryToken = null;
}

// Copia do token em memoria (caso o localStorage esteja bloqueado)
let memoryToken = getToken();

// Faz um pedido para a API. Se houver token, ele vai junto.
// Se a resposta for erro, lanca um Error com a mensagem e o status do servidor.
async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (memoryToken) headers.Authorization = `Bearer ${memoryToken}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(data?.error || `Erro ${res.status}`);
    error.status = res.status;
    // Tinha token e o servidor recusou: o token expirou ou e invalido -> sai da conta
    if (res.status === 401 && memoryToken) {
      logout();
    }
    throw error;
  }
  return data;
}

// Busca os dados do usuario logado e atualiza a tela
async function refreshUser() {
  if (!memoryToken) {
    currentUser = null;
  } else {
    try {
      currentUser = await api('/api/me');
    } catch (e) {
      currentUser = null;
    }
  }
  updateUserArea();
  if (typeof onUserChanged === 'function') onUserChanged();
}

function logout() {
  clearToken();
  currentUser = null;
  updateUserArea();
  if (typeof onUserChanged === 'function') onUserChanged();
}

// ---- Cabecalho: "Entrar" ou "nome + creditos + Sair" ----
const loggedOutArea = document.getElementById('logged-out');
const loggedInArea = document.getElementById('logged-in');
const userNameEl = document.getElementById('user-name');
const userCreditsEl = document.getElementById('user-credits');

function updateUserArea() {
  if (currentUser) {
    userNameEl.textContent = currentUser.username;
    userCreditsEl.textContent = currentUser.credits;
    loggedOutArea.hidden = true;
    loggedInArea.hidden = false;
  } else {
    loggedOutArea.hidden = false;
    loggedInArea.hidden = true;
  }
}

document.getElementById('logout-button').addEventListener('click', logout);

// ---- Janela de login / cadastro ----
const authDialog = document.getElementById('auth-dialog');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmit = document.getElementById('auth-submit');
const authToggle = document.getElementById('auth-toggle');
const authError = document.getElementById('auth-error');
const authMessage = document.getElementById('auth-message');
const passwordInput = document.getElementById('auth-password');
let authMode = 'login'; // 'login' ou 'register'

function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === 'login';
  authTitle.textContent = isLogin ? 'Entrar' : 'Criar conta';
  authSubmit.textContent = isLogin ? 'Entrar' : 'Cadastrar';
  authToggle.textContent = isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar';
  passwordInput.autocomplete = isLogin ? 'current-password' : 'new-password';
  authError.textContent = '';
}

// message: texto opcional explicando por que o login foi pedido
function openAuthDialog(message = '') {
  setAuthMode('login');
  authForm.reset();
  authMessage.textContent = message;
  authMessage.hidden = !message;
  if (typeof pauseGame === 'function') pauseGame();
  authDialog.showModal();
}

document.getElementById('open-login').addEventListener('click', () => openAuthDialog());
document.getElementById('auth-close').addEventListener('click', () => authDialog.close());
authToggle.addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = authForm.username.value.trim();
  const password = authForm.password.value;

  authSubmit.disabled = true;
  authError.textContent = '';
  try {
    const path = authMode === 'login' ? '/api/login' : '/api/register';
    const data = await api(path, { method: 'POST', body: { username, password } });
    saveToken(data.token);
    authDialog.close();
    await refreshUser();
    if (typeof onLoggedIn === 'function') onLoggedIn();
  } catch (error) {
    authError.textContent = error.message;
  } finally {
    authSubmit.disabled = false;
  }
});
