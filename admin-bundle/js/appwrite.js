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

/* HTML-escape helper — use for every user-controlled value in innerHTML */
function esc(s) {
  var d = document.createElement('div');
  d.textContent = String(s == null ? '' : s);
  return d.innerHTML;
}

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
  if (!account) return false;
  try {
    const user = await account.get();
    const email = (user.email || '').toLowerCase();
    /* Primary check: email matches the configured admin email */
    if (RONYX.ADMIN_EMAIL && email === (RONYX.ADMIN_EMAIL || '').toLowerCase()) return true;
    /* Secondary check: user is in the 'admins' Appwrite team */
    if (RONYX.REQUIRE_ADMIN_TEAM && teams) {
      const list = await teams.list();
      return list.teams.some(t => t.$id === 'admins' || (t.name || '').toLowerCase() === 'admins');
    }
    return false; /* fail-closed: deny if neither check passes */
  } catch (e) { return false; }
}

/* ── OTP-only auth ─────────────────────────────────────────
   Step 1: send OTP to the admin email
   Step 2: verify OTP → create session → enter dashboard
   ──────────────────────────────────────────────────────── */

let _pendingUserId = null;

async function adminSendOtp(email, onSent) {
  if (!RONYX.CONFIGURED) { goTo('dashboard.html'); return; }
  /* Block non-admin emails before touching Appwrite at all */
  if (RONYX.ADMIN_EMAIL && (email || '').toLowerCase() !== (RONYX.ADMIN_EMAIL || '').toLowerCase()) {
    toast('This email is not authorised to access the admin panel.', 'error');
    return;
  }
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
    const _sess = await account.createSession(_pendingUserId, otp.trim());
    /* Store session secret as localStorage fallback so the Appwrite SDK sends
       X-Fallback-Cookies on every request (including POST). Without this,
       SameSite=Lax cookie policy blocks cross-origin POST auth. */
    if (_sess && _sess.secret && window.localStorage) {
      const _ck = 'a_session_' + (RONYX.PROJECT_ID || '').toLowerCase();
      try { localStorage.setItem('cookieFallback', JSON.stringify({ [_ck]: _sess.secret })); } catch(e) {}
    }
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

/* Warn once per session if the session secret isn't stored (POST requests need it).
   The secret is saved on login — if missing, the admin must log out and back in. */
function _checkCookieFallback() {
  if (sessionStorage.getItem('ronyx_fb_ok')) return;
  sessionStorage.setItem('ronyx_fb_ok', '1');
  try {
    var fb = JSON.parse(localStorage.getItem('cookieFallback') || 'null');
    var key = 'a_session_' + (RONYX.PROJECT_ID || '').toLowerCase();
    if (!fb || !fb[key]) {
      setTimeout(function() {
        toast('Session needs refresh — log out and back in so saving/creating content works correctly.', 'info');
      }, 1500);
    }
  } catch(e) {}
}

/* Helper called by AI features to get the current session key */
function getAdminSessionKey() {
  try {
    var fb = JSON.parse(localStorage.getItem('cookieFallback') || '{}');
    var key = 'a_session_' + (RONYX.PROJECT_ID || '').toLowerCase();
    return fb[key] || '';
  } catch(e) { return ''; }
}

async function requireAdmin() {
  if (!RONYX.CONFIGURED) return;
  try {
    await account.get();
    if (!(await isAdmin())) goTo('login.html');
    _checkCookieFallback();
  } catch (e) { goTo('login.html'); }
}

/* backward-compat stubs */
async function adminLogin() {}
async function adminLoginStep1() {}
async function adminLoginStep2() {}
