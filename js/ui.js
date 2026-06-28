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
    { id: 'dashboard',     label: 'Home',    href: '/pages/student/dashboard.html',     d: 'M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z' },
    { id: 'exams',         label: 'Exams',   href: '/pages/student/exams.html',         d: 'M5 3h14v18l-7-3-7 3z' },
    { id: 'library',       label: 'Library', href: '/pages/student/library.html',       d: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5z' },
    { id: 'notifications', label: 'Alerts',  href: '/pages/student/notifications.html', d: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0', notif: true },
    { id: 'profile',       label: 'Profile', href: '/pages/student/profile.html',       d: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0z' },
  ];

  document.querySelectorAll('[data-nav]').forEach(bar => {
    const active = bar.getAttribute('data-nav');
    bar.innerHTML = tabs.map(t => `
      <a class="tab ${t.id === active ? 'is-active' : ''}" href="${t.href}" style="position:relative;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round"><path d="${t.d}"/></svg>
        ${t.notif ? '<span class="tab-badge" id="notifBadge" style="display:none;position:absolute;top:4px;right:calc(50% - 14px);background:#f43f5e;color:#fff;font-size:9px;font-weight:800;border-radius:8px;padding:1px 5px;min-width:16px;text-align:center;line-height:16px;"></span>' : ''}
        <span>${t.label}</span>
      </a>`).join('');
  });

  /* Load unread notification count and show badge */
  (async function() {
    if (!window.RONYX_CONFIG || !RONYX_CONFIG.CONFIGURED || !window.RonyxData) return;
    try {
      const n = await RonyxData.getUnreadCount();
      if (n > 0) {
        document.querySelectorAll('#notifBadge').forEach(function(b) {
          b.textContent = n > 99 ? '99+' : n;
          b.style.display = 'block';
        });
      }
    } catch(e) {}
  })();

  /* ---- Community WhatsApp toast (once per session, 3 seconds) ---- */
  (function() {
    if (sessionStorage.getItem('ronyx_comm_shown')) return;
    sessionStorage.setItem('ronyx_comm_shown', '1');
    setTimeout(function() {
      var toast = document.createElement('a');
      toast.href = 'https://chat.whatsapp.com/HJY9q7CJg6V5ICqLpbkfMA';
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
          '<div style="font-size:13px;font-weight:800;margin-bottom:2px;">Join the Runyx Community!</div>' +
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

  /* ---- Floating reload button (always visible, bottom-right above tab bar) ---- */
  (function() {
    function injectReloadBtn() {
      var btn = document.createElement('button');
      btn.innerHTML = '&#8635;';
      btn.title = 'Reload for latest updates';
      btn.style.cssText = [
        'position:fixed', 'bottom:calc(68px + env(safe-area-inset-bottom,0px))', 'right:14px',
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
