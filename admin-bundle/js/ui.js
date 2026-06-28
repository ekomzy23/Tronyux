/* ============================================================
   RONYX ADMIN &middot; ui.js
   Injects the admin bottom navigation.
   Usage: <nav class="tabbar" data-nav-admin="overview"></nav>
   ============================================================ */

(function () {
  const tabs = [
    { id: 'overview',  label: 'Home',     href: 'dashboard.html', d: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 9h8V3h-8z' },
    { id: 'exams',     label: 'Exams',    href: 'exams.html',     d: 'M5 3h14v18l-7-3-7 3z' },
    { id: 'students',  label: 'Students', href: 'students.html',  d: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
    { id: 'analytics', label: 'Analytics',href: 'analytics.html', d: 'M18 20V10M12 20V4M6 20v-6' },
    { id: 'more',      label: 'More',     href: 'more.html',      d: 'M12 5v.01M12 12v.01M12 19v.01' },
  ];

  document.querySelectorAll('[data-nav-admin]').forEach(bar => {
    const active = bar.getAttribute('data-nav-admin');
    bar.innerHTML = tabs.map(t => `
      <a class="tab ${t.id === active ? 'is-active' : ''}" href="${t.href}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round"><path d="${t.d}"/></svg>
        <span>${t.label}</span>
      </a>`).join('');
  });
})();

