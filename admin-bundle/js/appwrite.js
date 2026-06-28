/* ============================================================
   RONYX ADMIN · appwrite.js
   OTP-only admin auth — no password, email code every login.
   ============================================================ */

const RONYX = window.RONYX_CONFIG || { CONFIGURED: false };

let account = null, teams = null;
if (RONYX.CONFIGURED && window.Appwrite) {
  const client = new Appwrite.Client().setEndpoint(RONYX.ENDPOINT).setProject(RONYX.PROJECT_ID);
  account = new Appwrite.Account(client);
  teams   = new Appwrite.Teams(client);
}

function goTo(p) { location.href = p; }

function toast(msg, type) {
  type = type || 'info';
  let stack = document.getElementById('ronyx-toasts');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'ronyx-toasts';
    stack.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;min-width:260px;max-width:340px;pointer-events:none;';
    document.body.appendChild(stack);
  }
  const col = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#6d5efc';
  const el  = document.createElement('div');
  el.style.cssText = 'background:var(--color-surface,#1e1e2e);border:1px solid ' + col + ';border-radius:12px;padding:12px 16px;font-size:14px;color:var(--color-text,#fff);box-shadow:0 4px 24px rgba(0,0,0,.5);pointer-events:auto;cursor:pointer;';
  el.textContent = msg;
  el.onclick = () => el.remove();
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

async function isAdmin() {
  if (!RONYX.REQUIRE_ADMIN_TEAM) return true;
  if (!teams) return true;
  try {
    const list = await teams.list();
    return list.teams.some(t => t.$id === 'admins' || (t.name || '').toLowerCase() === 'admins');
  } catch (e) { return false; }
}

/* ── OTP-only auth ─────────────────────────────────────────
   Step 1: send OTP to the admin email
   Step 2: verify OTP → create session → enter dashboard
   ──────────────────────────────────────────────────────── */

let _pendingUserId = null;

async function adminSendOtp(email, onSent) {
  if (!RONYX.CONFIGURED) { goTo('dashboard.html'); return; }
  try {
    /* Clear any stale session before requesting a new token */
    try { await account.deleteSession('current'); } catch(e) {}

    const token = await account.createEmailToken(
      Appwrite.ID ? Appwrite.ID.unique() : ('id-' + Date.now()),
      email
    );
    _pendingUserId = token.userId;
    if (typeof onSent === 'function') onSent();
  } catch (e) {
    const msg = (e.message || '').toLowerCase();
    if (msg.includes('rate') || msg.includes('too many')) {
      toast('Too many attempts. Wait a moment and try again.', 'error');
    } else {
      toast('Could not send code: ' + (e.message || 'check your connection.'), 'error');
    }
  }
}

async function adminVerifyOtp(otp) {
  if (!_pendingUserId) { toast('Session expired. Send a new code.', 'error'); return; }
  try {
    /* Clear any stale session so Appwrite accepts the new token session */
    try { await account.deleteSession('current'); } catch(e) {}
    await account.createSession(_pendingUserId, otp.trim());
    if (await isAdmin()) {
      _pendingUserId = null;
      goTo('dashboard.html');
    } else {
      await account.deleteSession('current');
      toast('This account does not have admin access.', 'error');
    }
  } catch (e) {
    const map = {
      'user_invalid_token': 'Code is wrong or has expired — request a new one.',
      'general_rate_limit_exceeded': 'Too many attempts. Wait a moment.',
    };
    toast(map[e.type] || e.message || 'Invalid or expired code. Try again.', 'error');
  }
}

async function adminLogout() {
  if (RONYX.CONFIGURED && account) { try { await account.deleteSession('current'); } catch (e) {} }
  goTo('login.html');
}

async function requireAdmin() {
  if (!RONYX.CONFIGURED) return;
  try {
    await account.get();
    if (!(await isAdmin())) goTo('login.html');
  } catch (e) { goTo('login.html'); }
}

/* backward-compat stubs */
async function adminLogin() {}
async function adminLoginStep1() {}
async function adminLoginStep2() {}
