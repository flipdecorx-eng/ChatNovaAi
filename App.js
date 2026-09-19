// ChatNova AI — front end
//
// ⚠️ TEMPORARY SETUP FOR TODAY'S VIDEO ⚠️
// This calls Groq DIRECTLY from the browser with your API key written below.
// That means anyone who views this page's source code can see and copy your
// key. Fine to demo something working right now — not fine to leave live
// long-term. After the video: move this behind a backend/Worker, then
// generate a NEW Groq key and delete this one.

const GROQ_API_KEY = "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";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const THEME_KEY = "chatnova_theme";

// ---------- Element references ----------
const sidebar          = document.getElementById('sidebar');
const globalMenuToggle  = document.getElementById('globalMenuToggle');
const plusMenuBtn       = document.getElementById('plusMenuBtn');
const uploadPopupMenu   = document.getElementById('uploadPopupMenu');
const sendMsgBtn        = document.getElementById('sendMsgBtn');
const chatInputField    = document.getElementById('chatInputField');
const chatDisplay       = document.getElementById('chatDisplay');
const welcomeScreen     = document.getElementById('welcomeScreen');
const micBtn            = document.getElementById('micBtn');
const dynamicTitle      = document.getElementById('dynamicTitle');
const themeToggleBtn    = document.getElementById('themeToggleBtn');

let isLoading = false;
let conversationHistory = [];

// ---------- Theme (light / dark) ----------
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, theme);
}
(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const preferred = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(preferred);
})();
themeToggleBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ---------- Sidebar toggle (☰) ----------
globalMenuToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  sidebar.classList.toggle('collapsed');
  document.body.classList.toggle('sidebar-open');
});

// ---------- Plus / upload menu (➕) ----------
plusMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  uploadPopupMenu.classList.toggle('show');
});
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !globalMenuToggle.contains(e.target)) {
    sidebar.classList.add('collapsed');
    document.body.classList.remove('sidebar-open');
  }
  if (!uploadPopupMenu.contains(e.target) && !plusMenuBtn.contains(e.target)) {
    uploadPopupMenu.classList.remove('show');
  }
});

// ---------- Upload options ----------
document.querySelectorAll('.upload-option').forEach(option => {
  option.setAttribute('tabindex', '0');
  option.setAttribute('role', 'button');
  const handle = () => {
    const type = option.getAttribute('data-upload');
    uploadPopupMenu.classList.remove('show');
    hideWelcome();
    appendMessage(`📎 ${type} upload is coming soon!`, 'assistant');
  };
  option.addEventListener('click', handle);
  option.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handle(); } });
});

// ---------- Sidebar navigation ----------
document.querySelectorAll('.menu-items li').forEach(item => {
  item.setAttribute('tabindex', '0');
  item.setAttribute('role', 'button');
  const handle = () => {
    const category = item.getAttribute('data-category');
    dynamicTitle.textContent = `ChatNova AI — ${category}`;
    hideWelcome();
    appendMessage(`Switched to <strong>${category}</strong> mode. How can I help?`, 'assistant');
    if (window.innerWidth <= 768) {
      sidebar.classList.add('collapsed');
      document.body.classList.remove('sidebar-open');
    }
  };
  item.addEventListener('click', handle);
  item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handle(); } });
});

// ---------- Message rendering ----------
function hideWelcome() { if (welcomeScreen) welcomeScreen.style.display = 'none'; }

function escapeHtml(s = '') {
  return s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function formatText(text) {
  return text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}
function appendMessage(text, sender) {
  const row = document.createElement('div');
  row.className = 'msg-row ' + sender;
  row.innerHTML = `<div class="msg-avatar">${sender === 'assistant' ? '✨' : '🙂'}</div><div class="msg-content">${formatText(text)}</div>`;
  chatDisplay.appendChild(row);
  chatDisplay.scrollTop = chatDisplay.scrollHeight;
  return row;
}
function showTyping() {
  const row = document.createElement('div');
  row.className = 'msg-row assistant';
  row.id = 'typingIndicator';
  row.innerHTML = `<div class="msg-avatar">✨</div><div class="msg-content"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  chatDisplay.appendChild(row);
  chatDisplay.scrollTop = chatDisplay.scrollHeight;
}
function removeTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

// ---------- Groq call (direct from browser — see warning at top of file) ----------
async function callGroqAPI(userMessage) {
  conversationHistory.push({ role: 'user', content: userMessage });

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'You are ChatNova AI, a smart and friendly assistant. Be helpful, clear and concise.' },
        ...conversationHistory,
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Groq API error (${response.status})`);

  const reply = data.choices?.[0]?.message?.content;
  if (!reply) throw new Error('No response received from Groq.');

  conversationHistory.push({ role: 'assistant', content: reply });
  return reply;
}

// ---------- Send flow ----------
async function executeUserSend() {
  if (isLoading) return;
  const text = chatInputField.value.trim();
  if (!text) return;

  hideWelcome();
  appendMessage(escapeHtml(text), 'user');
  chatInputField.value = '';

  isLoading = true;
  sendMsgBtn.disabled = true;
  showTyping();

  try {
    const reply = await callGroqAPI(text);
    removeTyping();
    appendMessage(escapeHtml(reply), 'assistant');
  } catch (err) {
    removeTyping();
    appendMessage(`⚠️ ${escapeHtml(err.message)}`, 'assistant');
  } finally {
    isLoading = false;
    sendMsgBtn.disabled = false;
    chatInputField.focus();
  }
}

sendMsgBtn.addEventListener('click', executeUserSend);
chatInputField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    executeUserSend();
  }
});

micBtn.addEventListener('click', () => {
  hideWelcome();
  appendMessage('🎙️ Voice input is coming soon!', 'assistant');
});
