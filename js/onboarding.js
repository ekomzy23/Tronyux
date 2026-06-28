/* ============================================================
   RONYX · onboarding.js
   First-time walkthrough — full-screen slides, swipe-friendly.
   Shows once per device (localStorage flag ronyx_ob_v1).
   Load anywhere; self-contained — injects its own styles + DOM.
============================================================ */

(function () {
  'use strict';

  var STORE_KEY = 'ronyx_ob_v1';
  if (localStorage.getItem(STORE_KEY)) return;

  var SLIDES = [
    {
      icon: '&#127891;',
      title: 'Welcome to Ronyx',
      body:  'Your smart exam prep platform — study smarter, practise better, and score higher.',
      grad:  'linear-gradient(160deg,#1a0a3c 0%,#0d0d14 100%)',
      dot:   '#6D5EFC',
    },
    {
      icon: '&#128221;',
      title: 'Take Timed Exams',
      body:  'MCQ, True/False &amp; multi-select questions. Get instant feedback on every answer as you go.',
      grad:  'linear-gradient(160deg,#0a1a3c 0%,#0d0d14 100%)',
      dot:   '#3B82F6',
    },
    {
      icon: '&#128218;',
      title: 'Library &amp; Text-to-Speech',
      body:  'Read AI-powered book summaries or upload your own PDFs. Tap play and the app reads aloud while highlighting each line.',
      grad:  'linear-gradient(160deg,#0a2a1a 0%,#0d0d14 100%)',
      dot:   '#10B981',
    },
    {
      icon: '&#128276;',
      title: 'Stay Updated',
      body:  'Exam reminders, results and announcements land straight in your Notifications tab — never miss a thing.',
      grad:  'linear-gradient(160deg,#2a1a0a 0%,#0d0d14 100%)',
      dot:   '#F59E0B',
    },
    {
      icon: '&#128640;',
      title: "You're All Set!",
      body:  "That's everything you need to get started. Join our WhatsApp community for study tips and support from fellow students.",
      grad:  'linear-gradient(160deg,#1a0a3c 0%,#0d0d14 100%)',
      dot:   '#6D5EFC',
    },
  ];

  var cur = 0;
  var touchStartX = 0;

  /* ── Styles ─────────────────────────────────────────────── */
  var css = document.createElement('style');
  css.id  = 'ob-css';
  css.textContent = [
    '#ob{position:fixed;inset:0;z-index:99999;overflow:hidden;',
      'display:flex;flex-direction:column;',
      'font-family:"Sora","Inter",sans-serif;',
      'background:#0d0d14;',
      'user-select:none;-webkit-user-select:none;}',

    '#ob-skip{position:absolute;top:calc(16px + env(safe-area-inset-top,0px));right:16px;',
      'background:rgba(255,255,255,.1);border:none;color:rgba(255,255,255,.7);',
      'font-size:13px;font-weight:600;padding:7px 18px;border-radius:20px;',
      'cursor:pointer;font-family:inherit;z-index:2;',
      'transition:opacity .15s;}',
    '#ob-skip:active{opacity:.6;}',

    '#ob-track{flex:1;display:flex;',
      'transition:transform .38s cubic-bezier(.4,0,.2,1);}',

    '.ob-slide{min-width:100vw;flex-shrink:0;',
      'display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;',
      'padding:80px 36px 0;text-align:center;}',

    '.ob-icon{font-size:88px;line-height:1;margin-bottom:36px;',
      'display:block;',
      'animation:ob-pop .55s cubic-bezier(.34,1.56,.64,1) both;}',
    '@keyframes ob-pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}',

    '.ob-title{font-size:26px;font-weight:800;color:#fff;',
      'margin-bottom:16px;letter-spacing:-.025em;line-height:1.2;}',

    '.ob-body{font-size:15px;line-height:1.75;',
      'color:rgba(255,255,255,.62);max-width:310px;}',

    '#ob-bottom{padding:28px 28px calc(32px + env(safe-area-inset-bottom,0px));',
      'display:flex;flex-direction:column;align-items:center;gap:18px;}',

    '#ob-dots{display:flex;gap:8px;align-items:center;}',
    '.ob-dot{height:8px;width:8px;border-radius:50%;',
      'background:rgba(255,255,255,.2);',
      'transition:width .28s ease,background .28s ease;}',
    '.ob-dot.on{width:26px;border-radius:4px;}',

    '#ob-next{width:100%;max-width:360px;padding:18px 0;',
      'border:none;border-radius:16px;',
      'font-size:16px;font-weight:700;color:#fff;',
      'background:linear-gradient(135deg,#6D5EFC,#8B5CF6);',
      'box-shadow:0 8px 28px rgba(109,94,252,.45);',
      'cursor:pointer;font-family:inherit;',
      'transition:opacity .15s,transform .12s;}',
    '#ob-next:active{opacity:.82;transform:scale(.97);}',
  ].join('');
  document.head.appendChild(css);

  /* ── Build DOM ───────────────────────────────────────────── */
  var ov = document.createElement('div');
  ov.id  = 'ob';

  /* Skip button */
  var skip = document.createElement('button');
  skip.id = 'ob-skip';
  skip.textContent = 'Skip';
  skip.addEventListener('click', dismiss);

  /* Slide track */
  var track = document.createElement('div');
  track.id  = 'ob-track';

  SLIDES.forEach(function (s) {
    var sl = document.createElement('div');
    sl.className = 'ob-slide';
    sl.innerHTML =
      '<span class="ob-icon">' + s.icon + '</span>' +
      '<div class="ob-title">'  + s.title + '</div>' +
      '<div class="ob-body">'   + s.body  + '</div>';
    track.appendChild(sl);
  });

  /* Bottom bar */
  var bottom = document.createElement('div');
  bottom.id  = 'ob-bottom';

  var dotsEl = document.createElement('div');
  dotsEl.id  = 'ob-dots';
  SLIDES.forEach(function (_, i) {
    var d = document.createElement('div');
    d.className = 'ob-dot' + (i === 0 ? ' on' : '');
    dotsEl.appendChild(d);
  });

  var nextBtn = document.createElement('button');
  nextBtn.id  = 'ob-next';
  nextBtn.textContent = 'Next';
  nextBtn.addEventListener('click', advance);

  bottom.appendChild(dotsEl);
  bottom.appendChild(nextBtn);

  ov.appendChild(skip);
  ov.appendChild(track);
  ov.appendChild(bottom);
  document.body.appendChild(ov);

  /* ── Navigation ─────────────────────────────────────────── */
  function goTo(i) {
    cur = i;
    track.style.transform = 'translateX(-' + (cur * 100) + 'vw)';

    /* Update dot colours using slide accent */
    var dotEls = dotsEl.querySelectorAll('.ob-dot');
    dotEls.forEach(function (d, idx) {
      d.classList.toggle('on', idx === cur);
      d.style.background = idx === cur ? SLIDES[cur].dot : '';
    });

    /* Background gradient transitions per slide */
    ov.style.transition = 'background .5s ease';
    ov.style.background = SLIDES[cur].grad;

    /* Button label */
    nextBtn.textContent = cur === SLIDES.length - 1 ? 'Get Started →' : 'Next';

    /* Hide skip on last slide */
    skip.style.visibility = cur === SLIDES.length - 1 ? 'hidden' : 'visible';

    /* Re-trigger icon pop animation */
    var icon = track.querySelectorAll('.ob-icon')[cur];
    if (icon) {
      icon.style.animation = 'none';
      void icon.offsetWidth;
      icon.style.animation = '';
    }
  }

  function advance() {
    if (cur < SLIDES.length - 1) goTo(cur + 1);
    else dismiss();
  }

  function dismiss() {
    localStorage.setItem(STORE_KEY, '1');
    ov.style.transition = 'opacity .35s ease';
    ov.style.opacity    = '0';
    setTimeout(function () {
      ov.remove();
      css.remove();
    }, 360);
  }

  /* Set initial gradient */
  goTo(0);

  /* ── Swipe gestures ──────────────────────────────────────── */
  ov.addEventListener('touchstart', function (e) {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  ov.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (dx < -52 && cur < SLIDES.length - 1) goTo(cur + 1);
    else if (dx >  52 && cur > 0)              goTo(cur - 1);
  }, { passive: true });

  /* ── Keyboard ────────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (!document.getElementById('ob')) return;
    if (e.key === 'ArrowRight' || e.key === ' ') advance();
    if (e.key === 'ArrowLeft'  && cur > 0)       goTo(cur - 1);
    if (e.key === 'Escape')                       dismiss();
  });
})();
