/* ============================================================
   RUNYX · ui.js
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
  const theme = localStorage.getItem('runyx_theme');
  if (theme) root.setAttribute('data-theme', theme);

  const accent = localStorage.getItem('runyx_accent');
  if (accent) {
    root.style.setProperty('--color-primary', accent);
    root.style.setProperty('--color-primary-2', accent);
    root.style.setProperty('--gradient-brand', `linear-gradient(135deg, ${accent}, ${accent})`);
  }

  /* ---- 2. bottom tab bar ---- */
  const tabs = [
    { id: 'dashboard', label: 'Home',    href: '/pages/student/dashboard.html', d: 'M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z' },
    { id: 'exams',     label: 'Exams',   href: '/pages/student/exams.html',     d: 'M5 3h14v18l-7-3-7 3z' },
    { id: 'library',   label: 'Library', href: '/pages/student/library.html',   d: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5z' },
    { id: 'study',     label: 'Study',   href: '/pages/student/study.html',     d: 'M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2zM18 3v18' },
    { id: 'results',   label: 'Results', href: '/pages/student/results.html',   d: 'M4 20V10M10 20V4M16 20v-8M22 20H2' },
    { id: 'profile',   label: 'Profile', href: '/pages/student/profile.html',   d: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0z' },
  ];

  document.querySelectorAll('[data-nav]').forEach(bar => {
    const active = bar.getAttribute('data-nav');
    bar.innerHTML = tabs.map(t => `
      <a class="tab ${t.id === active ? 'is-active' : ''}" href="${t.href}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round"><path d="${t.d}"/></svg>
        <span>${t.label}</span>
      </a>`).join('');
  });
})();
