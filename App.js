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
  $$('.auth-tabs button').forEach(b => b.onclick = () => openAuth(b.dataset.tab));

  authOverlay.addEventListener('click', (e) => {
    if(e.target === authOverlay && !authRequired) authOverlay.classList.remove('show');
  });
  authCloseBtn.addEventListener('click', () => {
    if(!authRequired) authOverlay.classList.remove('show');
  });

  function renderUser(){
    if(state.user){
      $('#userAvatar').textContent = state.user.name.slice(0,1).toUpperCase();
      $('#userName').textContent = state.user.name;
      $('#userSub').textContent = state.user.email;
    } else {
      $('#userAvatar').textContent = 'G';
      $('#userName').textContent = 'Guest';
      $('#userSub').textContent = 'Sign in to save history';
    }
  }
  $('#userChipBtn').onclick = () => {
    if(state.user){
      if(confirm(`Log out of ${state.user.email}?`)){
        state.user = null; saveUser(); renderUser();
        toast('Logged out');
        lockApp();
      }
    } else {
      openAuth('login');
    }
  };
  $('#authForm').onsubmit = (e) => {
    e.preventDefault();
    const email = $('#authEmail').value.trim();
    const name = authMode === 'signup' ? ($('#authName').value.trim() || email.split('@')[0]) : (state.user?.name || email.split('@')[0]);
    state.user = { name, email };
    saveUser(); renderUser();
    unlockApp();
    toast(authMode === 'signup' ? `Welcome, ${name}! (demo account)` : `Welcome back, ${name}!`);
    e.target.reset();
  };
  renderUser();

  /* ---------------------------------------------------------------------
     Settings (Gemini connection)
     --------------------------------------------------------------------- */
  const settingsOverlay = $('#settingsOverlay');
  function openSettings(){
    $('#settingsKey').value = state.settings.apiKey;
    $('#settingsChatModel').value = state.settings.chatModel;
    $('#settingsImageModel').value = state.settings.imageModel;
    settingsOverlay.classList.add('show');
  }
  $('#settingsBtn').onclick = openSettings;
  $('#settingsForm').onsubmit = (e) => {
    e.preventDefault();
    state.settings = {
      apiKey: $('#settingsKey').value.trim(),
      chatModel: $('#settingsChatModel').value.trim() || 'gemini-2.0-flash',
      imageModel: $('#settingsImageModel').value.trim() || 'gemini-2.0-flash-preview-image-generation',
    };
    saveSettings();
    settingsOverlay.classList.remove('show');
    toast('Gemini connection saved');
  };
  settingsOverlay.addEventListener('click', (e) => { if(e.target === settingsOverlay) settingsOverlay.classList.remove('show'); });
  $$('[data-close]', settingsOverlay).forEach(b => b.onclick = () => settingsOverlay.classList.remove('show'));

  /* ---------------------------------------------------------------------
     Chat history (sidebar + library)
     --------------------------------------------------------------------- */
  function chatList(){ return Object.values(state.chats).sort((a,b) => b.updatedAt - a.updatedAt); }

  function escapeHtml(s=''){
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function renderHistory(){
    const list = $('#chatHistoryList');
    const chats = chatList();
    list.innerHTML = chats.length ? '' : '<div style="padding:10px 10px;color:var(--text-faint);font-size:12.5px;">No chats yet</div>';
    chats.slice(0, 30).forEach(c => {
      const item = document.createElement('div');
      item.className = 'history-item' + (c.id === state.activeChatId ? ' active' : '');
      item.innerHTML = `<span class="title">${escapeHtml(c.title || 'New chat')}</span>
        <button class="del-btn" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>`;
      item.onclick = (e) => { if(!e.target.closest('.del-btn')) openChat(c.id); };
      $('.del-btn', item).onclick = (e) => { e.stopPropagation(); deleteChat(c.id); };
      list.appendChild(item);
    });
  }

  function renderLibrary(){
    const list = $('#libraryList');
    const chats = chatList();
    if(!chats.length){ list.innerHTML = '<div class="library-empty">No saved chats yet. Start a conversation and it will show up here.</div>'; return; }
    list.innerHTML = '';
    chats.forEach(c => {
      const card = document.createElement('div');
      card.className = 'library-card';
      const preview = (c.messages.find(m => m.role === 'user')?.content || '').slice(0, 90);
      card.innerHTML = `
        <div style="min-width:0;">
          <div class="lc-title">${escapeHtml(c.title || 'New chat')}</div>
          <div class="lc-meta">${new Date(c.updatedAt).toLocaleString()} · ${c.messages.length} messages${preview ? ' · ' + escapeHtml(preview) + '…' : ''}</div>
        </div>
        <button class="lc-del" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>`;
      card.onclick = (e) => { if(!e.target.closest('.lc-del')){ openChat(c.id); showView('chat'); } };
      $('.lc-del', card).onclick = (e) => { e.stopPropagation(); deleteChat(c.id); renderLibrary(); };
      list.appendChild(card);
    });
  }

  function deleteChat(id){
    delete state.chats[id];
    saveChats();
    if(state.activeChatId === id){ state.activeChatId = null; localStorage.removeItem(LS.active); newChat(); }
    renderHistory();
  }

  function newChat(){
    state.activeChatId = null;
    localStorage.removeItem(LS.active);
    renderChatMessages();
    renderHistory();
    showView('chat');
  }
  $('#newChatBtn').onclick = newChat;

  function openChat(id){
    state.activeChatId = id;
    localStorage.setItem(LS.active, id);
    renderChatMessages();
    renderHistory();
    showView('chat');
  }

  function ensureChat(){
    if(state.activeChatId && state.chats[state.activeChatId]) return state.chats[state.activeChatId];
    const id = uid();
    state.chats[id] = { id, title: '', messages: [], updatedAt: Date.now() };
    state.activeChatId = id;
    localStorage.setItem(LS.active, id);
    return state.chats[id];
  }

  /* ---------------------------------------------------------------------
     Rendering messages
     --------------------------------------------------------------------- */
  function renderMarkdown(text=''){
    let escaped = escapeHtml(text);
    escaped = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre><code>${code}</code></pre>`);
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g,'<br>')}</p>`).join('');
    return escaped;
  }

  function renderChatMessages(){
    const chat = state.activeChatId ? state.chats[state.activeChatId] : null;
    const empty = $('#emptyState');
    const container = $('#messagesContainer');
    if(!chat || chat.messages.length === 0){
      empty.style.display = 'flex'; container.style.display = 'none'; container.innerHTML = '';
      return;
    }
    empty.style.display = 'none'; container.style.display = 'block'; container.innerHTML = '';
    chat.messages.forEach(m => container.appendChild(buildMessageEl(m)));
    scrollToBottom();
  }

  function buildMessageEl(m){
    const row = document.createElement('div');
    row.className = 'msg-row ' + m.role;
    const initials = m.role === 'user' ? (state.user ? state.user.name.slice(0,1).toUpperCase() : 'Y') : '';
    row.innerHTML = `
      <div class="msg-avatar">${m.role === 'assistant' ? '✨' : escapeHtml(initials)}</div>
      <div class="msg-body">
        ${m.attachments && m.attachments.length ? `<div class="msg-attachments">${m.attachments.map(a => `<img src="${a.dataUrl}" alt="${escapeHtml(a.name)}">`).join('')}</div>` : ''}
        <div class="msg-content">${m.pending ? '<div class="typing-dots"><span></span><span></span><span></span></div>' : renderMarkdown(m.content)}</div>
        ${!m.pending ? `<div class="msg-actions"><button class="copy-btn" title="Copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div>` : ''}
      </div>`;
    if(!m.pending){
      $('.copy-btn', row)?.addEventListener('click', () => { navigator.clipboard?.writeText(m.content); toast('Copied to clipboard'); });
    }
    return row;
  }

  function scrollToBottom(){
    const sc = $('#chatScroll');
    requestAnimationFrame(() => sc.scrollTop = sc.scrollHeight);
  }

  /* ---------------------------------------------------------------------
     Composer
     --------------------------------------------------------------------- */
  const messageInput = $('#messageInput');
  const sendBtn = $('#sendBtn');

  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
    sendBtn.disabled = !messageInput.value.trim() && state.pendingAttachments.length === 0;
  });
  messageInput.addEventListener('keydown', (e) => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); trySend(); } });

  $$('.suggestion-card').forEach(card => card.onclick = () => {
    messageInput.value = card.dataset.prompt;
    messageInput.dispatchEvent(new Event('input'));
    messageInput.focus();
  });

  $('#uploadImgBtn').onclick = () => $('#fileInput').click();
  $('#createImgBtn').onclick = () => showView('studio');

  $('#fileInput').addEventListener('change', (e) => {
    [...e.target.files].forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        state.pendingAttachments.push({ type:'image', name:file.name, mime:file.type, dataUrl:reader.result });
        renderAttachments();
        sendBtn.disabled = !messageInput.value.trim() && state.pendingAttachments.length === 0;
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  });

  function renderAttachments(){
    const wrap = $('#composerAttachments');
    wrap.innerHTML = '';
    state.pendingAttachments.forEach((a, i) => {
      const el = document.createElement('div');
      el.className = 'attach-thumb';
      el.innerHTML = `<img src="${a.dataUrl}">`;
      const rm = document.createElement('button');
      rm.className = 'rm'; rm.textContent = '×';
      rm.onclick = () => { state.pendingAttachments.splice(i,1); renderAttachments(); sendBtn.disabled = !messageInput.value.trim() && state.pendingAttachments.length === 0; };
      el.appendChild(rm);
      wrap.appendChild(el);
    });
  }

  /* ---------------------------------------------------------------------
     Sending messages + Gemini call
     --------------------------------------------------------------------- */
  function trySend(){
    const text = messageInput.value.trim();
    if(!text && state.pendingAttachments.length === 0) return;
    if(!state.settings.apiKey) toast('Add your Gemini API key in Settings to get real AI replies');
    sendMessage(text, state.pendingAttachments);
    messageInput.value = ''; messageInput.style.height = 'auto';
    state.pendingAttachments = []; renderAttachments(); sendBtn.disabled = true;
  }
  sendBtn.onclick = trySend;

  async function sendMessage(text, attachments){
    const chat = ensureChat();
    if(!chat.title) chat.title = text.slice(0, 40) || (attachments[0]?.name ?? 'New chat');
    chat.messages.push({ role: 'user', content: text, attachments: attachments.slice() });
    chat.updatedAt = Date.now();
    saveChats(); renderHistory(); renderChatMessages();

    const pendingMsg = { role: 'assistant', content: '', pending: true };
    chat.messages.push(pendingMsg);
    renderChatMessages();

    try{
      pendingMsg.content = await callGemini(chat.messages.filter(m => !m.pending));
    }catch(err){
      pendingMsg.content = `⚠️ ${err.message}`;
    }
    pendingMsg.pending = false;
    chat.updatedAt = Date.now();
    saveChats(); renderHistory(); renderChatMessages();
  }

  async function callGemini(messages){
    const { apiKey, chatModel } = state.settings;
    if(!apiKey) return demoReply(messages[messages.length-1]);

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: buildGeminiParts(m),
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chatModel || 'gemini-2.0-flash')}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });
    if(!res.ok){
      const errBody = await res.text().catch(()=> '');
      throw new Error(`Gemini API error (${res.status}). ${errBody.slice(0,150)}`);
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n').trim();
    return text || '(empty response)';
  }

  function buildGeminiParts(m){
    const parts = [];
    (m.attachments || []).forEach(a => {
      parts.push({ inline_data: { mime_type: a.mime, data: a.dataUrl.split(',')[1] } });
    });
    parts.push({ text: m.content || 'Describe this image.' });
    return parts;
  }

  function demoReply(lastMsg){
    if(lastMsg?.attachments?.length) return "Thanks for the photo! Add your Gemini API key in Settings and I'll actually be able to see and respond to it.";
    const t = lastMsg?.content || '';
    if(!t) return "I'm running in demo mode. Add your Gemini API key in Settings to get real replies.";
    return `You're in demo mode, so this is a canned reply. Add a Gemini API key in Settings and I'll respond for real to things like:\n\n"${t}"`;
  }

  /* ---------------------------------------------------------------------
     Image studio (Gemini image-generation preview model)
     --------------------------------------------------------------------- */
  $('#studioForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = $('#studioPrompt').value.trim();
    if(!prompt) return;
    const btn = $('#studioGenBtn');
    btn.disabled = true; btn.textContent = 'Generating…';

    const grid = $('#imageGrid');
    const placeholder = grid.querySelector('.placeholder');
    if(placeholder) placeholder.remove();

    const card = document.createElement('div');
    card.className = 'image-card placeholder';
    card.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
    grid.prepend(card);

    try{
      const url = await generateImage(prompt);
      card.classList.remove('placeholder');
      card.innerHTML = `<img src="${url}" alt="${escapeHtml(prompt)}"><div class="prompt-tag">${escapeHtml(prompt)}</div>`;
    }catch(err){
      card.innerHTML = `<span style="padding:10px;text-align:center;font-size:12px;">⚠️ ${escapeHtml(err.message)}</span>`;
    }
    btn.disabled = false; btn.textContent = 'Generate';
  });

  async function generateImage(prompt){
    const { apiKey, imageModel } = state.settings;
    if(!apiKey) throw new Error('Add your Gemini API key in Settings to create real images.');
    const model = imageModel || 'gemini-2.0-flash-preview-image-generation';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });
    if(!res.ok){
      const errBody = await res.text().catch(()=> '');
      throw new Error(`Image API error (${res.status}). Check the image model name in Settings. ${errBody.slice(0,120)}`);
    }
    const data = await res.json();
    const imgPart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data || p.inlineData);
    const inline = imgPart?.inline_data || imgPart?.inlineData;
    if(!inline) throw new Error('No image came back — this preview model may not be enabled for your key.');
    return `data:${inline.mime_type || inline.mimeType};base64,${inline.data}`;
  }

  /* ---------------------------------------------------------------------
     Pricing
     --------------------------------------------------------------------- */
  const PLANS = [
    { name: 'Free', desc: 'Explore ChatNova AI at no cost.', price: { monthly: 0, yearly: 0 },
      features: ['Standard response speed', '20 messages / day', 'Basic image creation', 'Chat history on this device'],
      cta: 'Current plan', featured: false },
    { name: 'Plus', desc: 'For everyday work and study.', price: { monthly: 12, yearly: 9.6 },
      features: ['Priority response speed', 'Unlimited messages', 'HD image creation', 'Photo uploads', 'Cloud-synced history'],
      cta: 'Upgrade to Plus', featured: true, badge: 'Most popular' },
    { name: 'Pro', desc: 'For power users and teams.', price: { monthly: 29, yearly: 23.2 },
      features: ['Everything in Plus', 'Highest priority access', 'Early access to new models', 'Priority support', 'Team workspaces'],
      cta: 'Upgrade to Pro', featured: false },
  ];
  let billingPeriod = 'monthly';
  function renderPlans(){
    const grid = $('#plansGrid');
    grid.innerHTML = PLANS.map(p => `
      <div class="plan-card ${p.featured ? 'featured' : ''}">
        ${p.badge ? `<span class="plan-badge">${p.badge}</span>` : ''}
        <div class="plan-name">${p.name}</div>
        <div class="plan-desc">${p.desc}</div>
        <div class="plan-price">$${p.price[billingPeriod].toFixed(p.price[billingPeriod] % 1 ? 2 : 0)}<span>/mo</span></div>
        <ul class="plan-features">${p.features.map(f => `<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>${f}</li>`).join('')}</ul>
        <button class="plan-cta" data-plan="${p.name}">${p.cta}</button>
      </div>`).join('');
    $$('.plan-cta').forEach(btn => btn.onclick = () => toast(`"${btn.dataset.plan}" selected — connect Stripe on a backend to charge cards.`));
  }
  $$('.billing-toggle button').forEach(btn => btn.onclick = () => {
    billingPeriod = btn.dataset.period;
    $$('.billing-toggle button').forEach(b => b.classList.toggle('active', b === btn));
    renderPlans();
  });
  renderPlans();

  /* ---------------------------------------------------------------------
     Init — gate the app behind sign up/login
     --------------------------------------------------------------------- */
  renderHistory();
  renderChatMessages();
  if(!state.user){
    lockApp();
  } else {
    authRequired = false;
  }
})();
