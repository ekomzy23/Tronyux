/* ============================================================
   RONYX · appwrite.js
   Backend config + auth helpers (Appwrite Web SDK).

   Load order:
     <script src="/js/appwrite.min.js"></script>   ← local copy
     <script src="/js/config.js"></script>
     <script src="/js/appwrite.js"></script>
   ============================================================ */

const RONYX = window.RONYX_CONFIG || { CONFIGURED: false };

// ---- Appwrite client ----
window.account = null;
if (RONYX.CONFIGURED && window.Appwrite) {
  const client = new Appwrite.Client()
    .setEndpoint(RONYX.ENDPOINT)
    .setProject(RONYX.PROJECT_ID);
  window.account = new Appwrite.Account(client);
}

// ---- Navigation ----
function goTo(path) { window.location.href = path; }

// ---- Toast notification system ----
function toast(msg, type = 'error', title = '') {
  const icons  = { error: '⚠️', success: '✅', info: 'ℹ️' };
  const titles = { error: 'Error', success: 'Success', info: 'Info' };

  let stack = document.getElementById('ronyx-toasts');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'ronyx-toasts';
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `
    <span class="toast__icon">${icons[type] || '⚠️'}</span>
    <div class="toast__body">
      <div class="toast__title">${title || titles[type]}</div>
      <div class="toast__msg">${msg}</div>
    </div>
    <span class="toast__close" onclick="this.closest('.toast').remove()">✕</span>`;
  stack.appendChild(el);

  // auto-dismiss after 5 s
  setTimeout(() => {
    el.classList.add('is-out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, 5000);
}

// ---- Appwrite → human-readable error ----
function appwriteError(err) {
  console.error('[Ronyx]', err); // always log full error to console
  const map = {
    'user_already_exists':          'An account with this email already exists. Try logging in instead.',
    'user_invalid_credentials':     'Invalid email or verification code. Please try again.',
    'user_invalid_token':           'The code is invalid or has expired. Request a new one.',
    'user_not_found':               'Invalid email or verification code. Please try again.',
    'user_email_not_whitelisted':   'This email is not allowed to register.',
    'user_password_mismatch':       'Invalid email or verification code. Please try again.',
    'general_rate_limit_exceeded':  'Too many attempts — please wait a moment and try again.',
    'general_argument_invalid':     'Invalid input. Check your details and try again.',
    'network_error':                'Cannot reach the server. Check your internet connection.',
  };
  // Appwrite puts the type on err.type
  return map[err.type] || err.message || 'Something went wrong. Please try again.';
}

// ---- Set button loading state ----
function setBusy(btnId, busy) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = busy ? 'Please wait…' : btn.dataset.label || btn.textContent;
}

/* ---- SIGN UP ----
   Send OTP only — do NOT create the account yet.
   The account + profile are created in otp.html after the code is verified.
   This prevents unverified ghost users appearing in Appwrite Auth or the DB. */
async function ronyxSignup(name, email, password, department, level) {
  if (!RONYX.CONFIGURED) return goTo('/pages/auth/otp.html');
  setBusy('signupBtn', true);
  try {
    const token = await window.account.createEmailToken(Appwrite.ID.unique(), email);
    sessionStorage.setItem('ronyx_email',      email);
    sessionStorage.setItem('ronyx_userId',     token.userId);
    sessionStorage.setItem('ronyx_password',   password);
    sessionStorage.setItem('ronyx_name',       name);
    sessionStorage.setItem('ronyx_department', department || '');
    sessionStorage.setItem('ronyx_level',      String(level || 1));
    goTo('/pages/auth/otp.html');
  } catch (err) {
    toast(appwriteError(err));
    setBusy('signupBtn', false);
  }
}

/* ---- VERIFY OTP ---- */
async function ronyxVerifyOtp(code) {
  if (!RONYX.CONFIGURED) return goTo('/pages/student/dashboard.html');
  if (code.length !== 6 || !/^\d+$/.test(code)) {
    return toast('Enter the full 6-digit code from your email.');
  }
  setBusy('verifyBtn', true);
  try {
    const userId = sessionStorage.getItem('ronyx_userId');
    if (!userId) {
      toast('Session expired. Please sign up again.');
      return goTo('/pages/auth/signup.html');
    }
    const _sess = await window.account.createSession(userId, code);
    /* Store session secret for cross-origin requests */
    if (_sess && _sess.secret && window.localStorage) {
      try {
        const _ck = 'a_session_' + (RONYX.PROJECT_ID || '').toLowerCase();
        localStorage.setItem('cookieFallback', JSON.stringify({ [_ck]: _sess.secret }));
      } catch(e) {}
    }
    /* Finalize account */
    const savedPass = sessionStorage.getItem('ronyx_password');
    const savedName = sessionStorage.getItem('ronyx_name');
    if (savedPass) { try { await window.account.updatePassword(savedPass); } catch(e) {} sessionStorage.removeItem('ronyx_password'); }
    if (savedName) { try { await window.account.updateName(savedName); }    catch(e) {} }
    /* Create profile document immediately — only verified users reach this point */
    if (window.RonyxData && window.RonyxData.createStudentProfile) {
      const savedEmail = sessionStorage.getItem('ronyx_email') || '';
      const dept  = sessionStorage.getItem('ronyx_department') || '';
      const level = parseInt(sessionStorage.getItem('ronyx_level') || '1') || 1;
      await window.RonyxData.createStudentProfile(savedName, savedEmail, dept, level).catch(function(){});
      ['ronyx_department','ronyx_level','ronyx_name'].forEach(function(k){ try{sessionStorage.removeItem(k);}catch(e){} });
    }
    goTo('/pages/student/dashboard.html');
  } catch (err) {
    toast(appwriteError(err));
    setBusy('verifyBtn', false);
  }
}

/* ---- RESEND OTP ---- */
async function ronyxResendOtp() {
  if (!RONYX.CONFIGURED) { toast('Resend not available in demo mode.', 'info'); return; }
  const email = sessionStorage.getItem('ronyx_email');
  if (!email) { toast('Session expired. Please sign up again.'); return goTo('/pages/auth/signup.html'); }
  try {
    const token = await window.account.createEmailToken(Appwrite.ID.unique(), email);
    sessionStorage.setItem('ronyx_userId', token.userId);
    toast('A new code has been sent to ' + email, 'success', 'Code sent');
  } catch (err) {
    toast(appwriteError(err));
  }
}

/* ---- LOGIN ---- */
async function ronyxLogin(email, password) {
  if (!RONYX.CONFIGURED) return goTo('/pages/student/dashboard.html');
  setBusy('loginBtn', true);
  try {
    await window.account.createEmailPasswordSession(email, password);
    goTo('/pages/student/dashboard.html');
  } catch (err) {
    toast(appwriteError(err));
    setBusy('loginBtn', false);
  }
}

/* ---- FORGOT PASSWORD ---- */
async function ronyxForgot(email) {
  if (!RONYX.CONFIGURED) {
    toast('Reset link sent! (demo mode)', 'success');
    return goTo('/pages/auth/login.html');
  }
  setBusy('forgotBtn', true);
  try {
    const redirect = window.location.origin + '/pages/auth/login.html';
    await window.account.createRecovery(email, redirect);
    toast('Check your email for the reset link.', 'success', 'Email sent');
    goTo('/pages/auth/login.html');
  } catch (err) {
    toast(appwriteError(err));
    setBusy('forgotBtn', false);
  }
}

/* ---- LOGOUT ---- */
async function ronyxLogout() {
  if (RONYX.CONFIGURED && window.account) {
    try { await window.account.deleteSession('current'); } catch (e) {}
  }
  goTo('/pages/auth/welcome.html');
}

/* ---- AUTH GUARD ----
   Runs automatically on every /pages/student/ URL.
   If there is no valid Appwrite session the user is sent to login immediately.
   Unverified/ghost accounts have no session → they are blocked here.
   Verified users who completed OTP have a session → they pass through.       */
(async function ronyxAuthGuard() {
  try {
    /* Only protect student pages — skip auth, admin, and other paths */
    if (!window.location.pathname.includes('/pages/student/')) return;
    if (!RONYX.CONFIGURED || !window.account) return;

    await window.account.get();
    /* Session is valid — user is authenticated, nothing to do */
  } catch (_) {
    /* No session (or session expired) → hard redirect to login */
    window.location.replace('/pages/auth/login.html');
  }
}());
