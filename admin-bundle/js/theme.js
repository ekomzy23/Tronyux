/* ============================================================
   RONYX · theme.js
   Loads on EVERY page. Does two things:
     1. restores the saved light/dark theme + accent
     2. injects a working light/dark toggle button
        (into the appbar if there is one, else floating top-right)
   ============================================================ */

(function () {
  const root = document.documentElement;

  // 1. restore saved choices
  const saved = localStorage.getItem('ronyx_theme') || 'dark';
  root.setAttribute('data-theme', saved);
  const accent = localStorage.getItem('ronyx_accent');
  if (accent) {
    root.style.setProperty('--color-primary', accent);
    root.style.setProperty('--color-primary-2', accent);
    root.style.setProperty('--gradient-brand', `linear-gradient(135deg, ${accent}, ${accent})`);
  }

  const icon = t => t === 'dark' ? '☀️' : '🌙';

  function toggle() {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('ronyx_theme', next);
    btn.textContent = icon(next);
  }

  // 2. build the toggle button
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = icon(saved);
  btn.title = 'Toggle light / dark';
  btn.addEventListener('click', toggle);

  // place it: into the appbar if present, else floating
  window.addEventListener('DOMContentLoaded', () => {
    const appbar = document.querySelector('.appbar');
    if (appbar) {
      btn.className = 'theme-toggle';
      appbar.appendChild(btn);
    } else {
      btn.className = 'theme-toggle theme-toggle--fixed';
      (document.querySelector('.app') || document.body).appendChild(btn);
    }
  });
})();
