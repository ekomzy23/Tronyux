/* ============================================================
   RONYX · ui.js
   Shared UI helpers:
     1. restores the saved theme + accent (set on Appearance page)
     2. builds the bottom tab bar

   Usage — put an empty bar where you want the nav, with
   data-nav set to the active tab:
     <nav class="tabbar" data-nav="dashboard"></nav>
   Then load this script at the end of the page:
     <script src="/js/ui.js"></script>
   ============================================================ */

(function () {

  /* ---- 1. restore saved appearance ---- */
  const root = document.documentElement;
  const theme = localStorage.getItem('ronyx_theme');
  if (theme) root.setAttribute('data-theme', theme);

  const accent = localStorage.getItem('ronyx_accent');
  if (accent) {
    root.style.setProperty('--color-primary', accent);
    root.style.setProperty('--color-primary-2', accent);
    root.style.setProperty('--gradient-brand', `linear-gradient(135deg, ${accent}, ${accent})`);
  }

  /* ---- 2. bottom tab bar ---- */
  const tabs = [
    { id: 'dashboard',  label: 'Home',      href: '/pages/student/dashboard.html',  d: 'M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z' },
    { id: 'exams',      label: 'Exams',     href: '/pages/student/exams.html',      d: 'M5 3h14v18l-7-3-7 3z' },
    { id: 'library',    label: 'Library',   href: '/pages/student/library.html',    d: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5z' },
    { id: 'community',  label: 'Nexus',     href: '/pages/student/community.html',  d: 'M13 2L3 14h9l-1 8 10-12h-9z', color: 'url(#nx-grad)' },
    { id: 'profile',    label: 'Profile',   href: '/pages/student/profile.html',    d: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0z' },
  ];

  document.querySelectorAll('[data-nav]').forEach(bar => {
    const active = bar.getAttribute('data-nav');
    const gradDef = `<svg width="0" height="0" style="position:absolute;"><defs><linearGradient id="nx-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#7c6df5"/><stop offset="100%" stop-color="#ff4d8c"/></linearGradient></defs></svg>`;
    bar.innerHTML = gradDef + tabs.map(t => {
      const isSocial = t.id === 'community';
      const isActive = t.id === active;
      const strokeColor = isSocial ? (isActive ? 'url(#nx-grad)' : 'currentColor') : 'currentColor';
      const labelStyle  = isSocial && isActive ? 'background:linear-gradient(90deg,#7c6df5,#ff4d8c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:800;' : '';
      return `
      <a class="tab ${isActive ? 'is-active' : ''}" href="${t.href}">
        <span style="position:relative;display:inline-flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"><path d="${t.d}"/></svg>
          ${t.notif ? '<span id="notifBadge" style="display:none;position:absolute;top:-5px;right:-7px;background:#f43f5e;color:#fff;font-size:9px;font-weight:800;border-radius:8px;padding:1px 5px;min-width:16px;text-align:center;line-height:16px;pointer-events:none;z-index:10;white-space:nowrap;"></span>' : ''}
        </span>
        <span style="${labelStyle}">${t.label}</span>
      </a>`;
    }).join('');
  });

  /* Load unread notification count → tab badge + OS app-icon badge */
  (async function() {
    if (!window.RONYX_CONFIG || !RONYX_CONFIG.CONFIGURED || !window.RonyxData) return;
    try {
      const n = await RonyxData.getUnreadCount();
      if (n > 0) {
        document.querySelectorAll('#notifBadge').forEach(function(b) {
          b.textContent = n > 99 ? '99+' : String(n);
          b.style.display = 'block';
        });
        /* Set OS-level app icon badge (Android Chrome when installed to home screen) */
        if ('setAppBadge' in navigator) navigator.setAppBadge(n).catch(function(){});
      } else {
        if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(function(){});
      }
    } catch(e) {}
  })();

  /* Track whether the community toast is about to show for the FIRST time
     this session — used below to time the push-permission modal correctly. */
  var _commFreshShow = !sessionStorage.getItem('ronyx_comm_shown');

  /* ---- Community WhatsApp toast (once per session, 3 seconds) ---- */
  /* Suppress on exam page — distracting and overlaps the mic/TTS FABs  */
  (function() {
    if (/\/exam\.html/.test(location.pathname)) return;
    if (sessionStorage.getItem('ronyx_comm_shown')) return;
    sessionStorage.setItem('ronyx_comm_shown', '1');
    setTimeout(function() {
      var toast = document.createElement('a');
      toast.href = 'https://chat.whatsapp.com/JixuoADKrsX9O8z0wlr3FC';
      toast.target = '_blank';
      toast.rel = 'noopener';
      toast.style.cssText = [
        'position:fixed','bottom:calc(72px + env(safe-area-inset-bottom,0px))','left:12px','right:12px',
        'z-index:9000','background:linear-gradient(135deg,#25D366,#128C7E)',
        'color:#fff','border-radius:16px','padding:13px 16px',
        'display:flex','align-items:center','gap:12px',
        'text-decoration:none','box-shadow:0 8px 28px rgba(37,211,102,.45)',
        'animation:toastIn .35s ease','cursor:pointer',
      ].join(';');
      toast.innerHTML =
        '<span style="font-size:26px;">&#128172;</span>' +
        '<div style="flex:1;">' +
          '<div style="font-size:13px;font-weight:800;margin-bottom:2px;">Join the Ronyx Community!</div>' +
          '<div style="font-size:11px;opacity:.9;">Exam tips, study groups &amp; announcements &#8250;</div>' +
        '</div>' +
        '<span style="font-size:20px;opacity:.8;">&#10005;</span>';

      /* Inject keyframes if not already present */
      if (!document.getElementById('toastKf')) {
        var s = document.createElement('style');
        s.id = 'toastKf';
        s.textContent = '@keyframes toastIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}' +
                         '@keyframes toastOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(16px)}}';
        document.head.appendChild(s);
      }

      document.body.appendChild(toast);

      /* Close button stops propagation */
      toast.querySelector('span:last-child').addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation(); dismiss();
      });

      function dismiss() {
        toast.style.animation = 'toastOut .3s ease forwards';
        setTimeout(function(){ if(toast.parentNode) toast.parentNode.removeChild(toast); }, 320);
      }

      /* Auto-dismiss after 3 seconds */
      setTimeout(dismiss, 3000);
    }, 1500); /* delay 1.5s after page load so user sees the page first */
  })();

  /* ---- Push notification permission flash (once per session) ---- */
  /* Shows after the community toast has had time to disappear.
     Only triggers when the user has not yet granted or denied permission. */
  (function() {
    if (/\/exam\.html/.test(location.pathname)) return;
    if (!('Notification' in window) || !('PushManager' in window)) return;
    if (Notification.permission !== 'default') return;
    if (sessionStorage.getItem('ronyx_push_flash')) return;
    sessionStorage.setItem('ronyx_push_flash', '1');

    /* _commFreshShow is true when the community toast is showing on THIS page load.
       In that case wait until after it dismisses (~5.5s); otherwise show at 3s. */
    var delay = _commFreshShow ? 5500 : 3000;

    setTimeout(function() {
      if (Notification.permission !== 'default') return;

      if (!document.getElementById('toastKf')) {
        var s = document.createElement('style');
        s.id = 'toastKf';
        s.textContent =
          '@keyframes toastIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}' +
          '@keyframes toastOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(16px)}}';
        document.head.appendChild(s);
      }

      var box = document.createElement('div');
      box.style.cssText = [
        'position:fixed',
        'bottom:calc(72px + env(safe-area-inset-bottom,0px) + 10px)',
        'left:12px','right:12px','z-index:9100',
        'background:var(--color-surface,#1e1e3a)',
        'border:1px solid rgba(109,94,252,.4)',
        'border-radius:18px','padding:14px',
        'box-shadow:0 10px 36px rgba(0,0,0,.5)',
        'display:flex','align-items:center','gap:10px',
        'animation:toastIn .35s ease',
      ].join(';');
      box.innerHTML =
        '<span style="font-size:26px;flex-shrink:0;">&#128276;</span>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;font-weight:700;color:var(--color-text,#fff);margin-bottom:2px;">Never miss an update</div>' +
          '<div style="font-size:11px;color:var(--color-muted,#8080a0);line-height:1.4;">Allow exam alerts &amp; announcements on your device</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">' +
          '<button id="_rxPA" style="padding:7px 11px;background:var(--color-primary-2,#6d5efc);color:#fff;border:none;border-radius:10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;touch-action:manipulation;">Allow</button>' +
          '<button id="_rxPX" style="padding:6px 8px;background:transparent;color:var(--color-muted,#8080a0);border:none;border-radius:10px;font-size:18px;line-height:1;cursor:pointer;touch-action:manipulation;">&#10005;</button>' +
        '</div>';
      document.body.appendChild(box);

      function dismissBox() {
        box.style.animation = 'toastOut .3s ease forwards';
        setTimeout(function() { if (box.parentNode) box.parentNode.removeChild(box); }, 320);
      }
      document.getElementById('_rxPA').addEventListener('click', function() {
        dismissBox();
        window.location.href = '/pages/student/notifications.html';
      });
      document.getElementById('_rxPX').addEventListener('click', function(e) {
        e.stopPropagation(); dismissBox();
      });
      setTimeout(dismissBox, 4000);
    }, delay);
  })();

  /* ---- Floating reload button (suppressed on exam page to prevent mid-exam data loss) ---- */
  (function() {
    if (/\/exam\.html/.test(location.pathname)) return;
    function injectReloadBtn() {
      var btn = document.createElement('button');
      btn.innerHTML = '&#8635;';
      btn.title = 'Reload for latest updates';
      btn.style.cssText = [
        'position:fixed', 'top:calc(env(safe-area-inset-top,0px) + 10px)', 'right:14px',
        'z-index:8999', 'width:36px', 'height:36px', 'border-radius:50%', 'border:none',
        'cursor:pointer', 'background:var(--color-surface,#1e1e3a)',
        'color:var(--color-muted-2,#8080a0)', 'font-size:17px',
        'box-shadow:0 2px 10px rgba(0,0,0,.22)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'touch-action:manipulation', 'transition:opacity .2s',
      ].join(';');
      btn.addEventListener('click', function() { location.reload(); });
      document.body.appendChild(btn);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectReloadBtn);
    } else {
      injectReloadBtn();
    }
  })();
})();
