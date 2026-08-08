/* ==========================================================================
   ChatNova AI — app.js (Gemini edition, sign up required)
   Front-end only (GitHub Pages). Persists to localStorage.

   NOTE on real functionality:
   - "Login/Sign up" is a local demo (no server) — it gates the UI so people
     must create a (demo) account before chatting, but there's no real
     password check against a backend. Wire up a real auth provider
     (Firebase Auth, Supabase Auth, etc.) for real accounts.
   - "AI replies" call the Gemini API directly from the browser using the key
     pasted into Settings. Fine for personal use; for a public product, put a
     small backend/proxy between this page and Google's API instead.
   - "Create image" calls Gemini's image-generation preview model. Google
     changes these preview model names periodically.
   - "Plans" is a static pricing UI. Wire up Stripe (or similar) on a backend
     to actually take payments.
   ========================================================================== */

(() => {
  const $  = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];

  const LS = {
    chats:    'chatnova_chats_v2',
    active:   'chatnova_active_chat_v2',
    settings: 'chatnova_settings_v2',
    user:     'chatnova_user_v2',
  };

  const uid = () => Math.random().toString(36).slice(2, 10);

  let state = {
    chats: JSON.parse(localStorage.getItem(LS.chats) || '{}'),
    activeChatId: localStorage.getItem(LS.active) || null,
    settings: JSON.parse(localStorage.getItem(LS.settings) || 'null') || {
      apiKey: '', chatModel: 'gemini-2.0-flash', imageModel: 'gemini-2.0-flash-preview-image-generation'
    },
    user: JSON.parse(localStorage.getItem(LS.user) || 'null'),
    pendingAttachments: [],
  };

  const saveChats    = () => localStorage.setItem(LS.chats, JSON.stringify(state.chats));
  const saveSettings = () => localStorage.setItem(LS.settings, JSON.stringify(state.settings));
  const saveUser     = () => localStorage.setItem(LS.user, JSON.stringify(state.user));

  function toast(msg, ms=3200){
    const stack = $('#toastStack');
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    stack.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .2s'; setTimeout(()=>el.remove(), 200); }, ms);
  }

  const app = $('#app');
  $('#mobileMenuBtn').onclick = () => app.classList.add('sidebar-open');
  $('#scrim').onclick = () => app.classList.remove('sidebar-open');

  /* ---------------------------------------------------------------------
     View routing
     --------------------------------------------------------------------- */
  function showView(name){
    $$('.view').forEach(v => v.classList.remove('active'));
    $(`#view-${name}`).classList.add('active');
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.nav === name));
    app.classList.remove('sidebar-open');
  }

  const TOPIC_STARTERS = {
    projects: "Let's plan a new project. Ask me what I'm working on and help me break it into steps.",
    schedule: "Help me organize my schedule for the week — ask me what I have going on.",
    learn:    "I want to learn to code. Ask me what language interests me and suggest a first project.",
  };

  $$('.nav-item').forEach(btn => btn.onclick = () => {
    const nav = btn.dataset.nav;
    if(nav === 'apps'){ showView('studio'); return; }
    if(nav === 'library'){ renderLibrary(); showView('library'); return; }
    showView('chat');
    if(TOPIC_STARTERS[nav]){
      messageInput.value = TOPIC_STARTERS[nav];
      messageInput.dispatchEvent(new Event('input'));
    }
  });

  /* ---------------------------------------------------------------------
     Auth gate — sign up/login is REQUIRED before the app is usable
     --------------------------------------------------------------------- */
  const authOverlay = $('#authOverlay');
  const authCloseBtn = $('#authCloseBtn');
  let authMode = 'signup';
  let authRequired = !state.user; // true until someone is logged in

  function lockApp(){
    app.classList.add('locked');
    authRequired = true;
    authCloseBtn.classList.add('hidden');
    openAuth('signup');
  }
  function unlockApp(){
    app.classList.remove('locked');
    authRequired = false;
    authCloseBtn.classList.remove('hidden');
    authOverlay.classList.remove('show');
  }

  function openAuth(mode){
    authMode = mode;
    $$('.auth-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === mode));
    $('#nameField').style.display = mode === 'signup' ? 'block' : 'none';
    $('#authTitle').textContent = mode === 'signup' ? 'Create your account' : 'Welcome back';
    $('#authSub').textContent = mode === 'signup' ? 'Sign up to start chatting and save your history.' : 'Log in to pick up where you left off.';
    $('#authSubmitBtn').textContent = mode === 'signup' ? 'Sign up' : 'Log in';
    $('#gateBanner').style.display = authRequired ? 'flex' : 'none';
    authOverlay.classList.add('show');
  }
  $$('.auth-tabs button').forEach(b => b.onclick = () =>
