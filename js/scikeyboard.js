/* ============================================================
   RONYX · scikeyboard.js  v5
   Fixed-position math keyboard for theory textareas.
   Usage: RonyxSciKeyboard.attach(textarea)
   ============================================================ */
window.RonyxSciKeyboard = (function () {
  'use strict';

  var _ta    = null;
  var _panel = null;
  var _actRow= null;   /* bottom Space/↵/⌫ row — hidden on ABC tab */
  var _tab   = '123';
  var _caps  = false;  /* false = lowercase, true = UPPERCASE */

  /* ── Key data (ABC rendered dynamically) ────────────────── */
  var TABS = {
    '123': [
      ['7','7'], ['8','8'], ['9','9'], ['+','+'],  ['⌫','__DEL'],
      ['4','4'], ['5','5'], ['6','6'], ['−','-'],  ['×','×'],
      ['1','1'], ['2','2'], ['3','3'], ['÷','÷'],  ['=','='],
      ['0','0'], ['.','.'],[' ',' '], ['(','('],  [')',')'],
      ['%','%'], ['^','^'], ['√','√'],['²','²'],  ['³','³'],
      ['<','<'], ['≤','≤'],['≥','≥'], ['>','>'],  ['≠','≠'],
    ],

    /* 36 items in 6 columns = 6 rows — all fit without scrolling */
    'Math': [
      /* Row 1 — Calculus */
      ['∫dx',  '∫ f(x) dx'],
      ['∫ₐᵇ',  '__INTLIM'],
      ['d/dx', 'd/dx[f(x)]'],
      ['lim',  'lim_{x→a} f(x)'],
      ['Σ',    'Σᵢ₌₁ⁿ f(i)'],
      ['∂',    '∂'],
      /* Row 2 — Symbols */
      ['∞',   '∞'],  ['√',  '√'],  ['∛', '∛'],
      ['½',   '½'],  ['¼',  '¼'],  ['∇', '∇'],
      /* Row 3 — Sets */
      ['∈','∈'], ['∉','∉'], ['⊂','⊂'], ['⊆','⊆'], ['∪','∪'], ['∩','∩'],
      /* Row 4 — Logic */
      ['∀','∀'], ['∃','∃'], ['∧','∧'], ['∨','∨'], ['¬','¬'], ['∴','∴'],
      /* Row 5 — Relations / Arrows */
      ['→','→'], ['⇒','⇒'], ['⟺','⟺'], ['≈','≈'], ['≡','≡'], ['±','±'],
      /* Row 6 — Script / Indices */
      ['⁻¹','⁻¹'], ['x²','²'], ['x³','³'], ['₀','₀'], ['₁','₁'], ['₂','₂'],
    ],

    /* 35 items in 5 columns = 7 rows */
    'Greek': [
      ['α','α'], ['β','β'], ['γ','γ'], ['δ','δ'], ['ε','ε'],
      ['ζ','ζ'], ['η','η'], ['θ','θ'], ['ι','ι'], ['κ','κ'],
      ['λ','λ'], ['μ','μ'], ['ν','ν'], ['ξ','ξ'], ['ρ','ρ'],
      ['σ','σ'], ['τ','τ'], ['υ','υ'], ['φ','φ'], ['χ','χ'],
      ['ψ','ψ'], ['ω','ω'], ['Γ','Γ'], ['Δ','Δ'], ['Θ','Θ'],
      ['Λ','Λ'], ['Ξ','Ξ'], ['Π','Π'], ['Σ','Σ'], ['Υ','Υ'],
      ['Φ','Φ'], ['Ψ','Ψ'], ['Ω','Ω'], ['π','π'], ['∞','∞'],
    ],
  };

  /* ── Insert text at cursor ──────────────────────────────── */
  function ins(text) {
    if (!_ta) return;
    var s = _ta.selectionStart, e = _ta.selectionEnd;
    _ta.value = _ta.value.slice(0, s) + text + _ta.value.slice(e);
    _ta.selectionStart = _ta.selectionEnd = s + text.length;
    _ta.dispatchEvent(new Event('input'));
  }

  function bsp() {
    if (!_ta) return;
    var s = _ta.selectionStart, e = _ta.selectionEnd;
    if (s !== e) {
      _ta.value = _ta.value.slice(0, s) + _ta.value.slice(e);
      _ta.selectionStart = _ta.selectionEnd = s;
    } else if (s > 0) {
      _ta.value = _ta.value.slice(0, s - 1) + _ta.value.slice(s);
      _ta.selectionStart = _ta.selectionEnd = s - 1;
    }
    _ta.dispatchEvent(new Event('input'));
  }

  /* Prevent textarea blur when tapping keyboard */
  function noBlur(el) {
    el.addEventListener('mousedown',  function (e) { e.preventDefault(); });
    el.addEventListener('touchstart', function (e) { e.preventDefault(); el.click(); }, { passive: false });
  }

  /* ── Create a generic key button ────────────────────────── */
  function makeKey(label, fn, bg, style) {
    var k = document.createElement('button');
    k.type = 'button';
    /* Allow raw HTML for math symbols */
    if (label && label.indexOf('<') !== -1) { k.innerHTML = label; }
    else { k.textContent = label; }
    k.style.cssText = [
      'border-radius:7px', 'font-size:15px',
      'border:1px solid rgba(255,255,255,.09)',
      'background:' + (bg || 'rgba(255,255,255,.07)'),
      'color:#f0f0f0', 'cursor:pointer',
      '-webkit-tap-highlight-color:transparent',
      'min-height:38px', 'display:flex',
      'align-items:center', 'justify-content:center',
      'padding:0 3px', style || '',
    ].join(';');
    k.addEventListener('click', fn);
    noBlur(k);
    return k;
  }

  /* ── Build keyboard panel (once) ───────────────────────── */
  function build() {
    if (_panel) return;

    _panel = document.createElement('div');
    _panel.id = 'ronyxKb';
    _panel.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0', 'z-index:9999',
      'background:#0e0e26',
      'border-top:2px solid rgba(109,94,252,.55)',
      'box-shadow:0 -10px 40px rgba(0,0,0,.65)',
      'padding:6px 6px 10px',
      'transform:translateY(100%)', 'transition:transform .2s ease',
      '-webkit-user-select:none', 'user-select:none',
    ].join(';');

    /* ── Tab selector row ── */
    var tabRow = document.createElement('div');
    tabRow.style.cssText = 'display:flex;gap:4px;margin-bottom:6px;align-items:center;';

    ['123', 'Math', 'Greek', 'ABC'].forEach(function (name) {
      var t = document.createElement('button');
      t.type = 'button'; t.textContent = name;
      t.setAttribute('data-rktab', name);
      t.style.cssText = [
        'flex:1', 'padding:5px 2px', 'border-radius:8px',
        'font-size:11px', 'font-weight:800',
        'border:1px solid rgba(255,255,255,.1)',
        'cursor:pointer', 'color:#888',
        'background:rgba(255,255,255,.05)',
        '-webkit-tap-highlight-color:transparent',
      ].join(';');
      noBlur(t);
      t.addEventListener('click', function () { switchTab(name); });
      tabRow.appendChild(t);
    });

    /* ⌨ Switch to native keyboard */
    var natBtn = document.createElement('button');
    natBtn.type = 'button'; natBtn.innerHTML = '⌨';
    natBtn.style.cssText = [
      'flex:0 0 36px', 'padding:5px 2px', 'border-radius:8px', 'font-size:16px',
      'border:1px solid rgba(52,211,153,.3)', 'background:rgba(52,211,153,.1)',
      'color:#34d399', 'cursor:pointer', '-webkit-tap-highlight-color:transparent',
    ].join(';');
    noBlur(natBtn);
    natBtn.addEventListener('click', function () { toNative(); });
    tabRow.appendChild(natBtn);

    /* ── Key area ── */
    var grid = document.createElement('div');
    grid.id = 'ronyxKbGrid';
    /* Initial style — overridden per-tab in switchTab */
    grid.style.cssText = 'margin-bottom:4px;';

    /* ── Bottom action row (Space / ↵ / ⌫) — hidden for ABC ── */
    _actRow = document.createElement('div');
    _actRow.style.cssText = 'display:grid;grid-template-columns:3fr 1fr 1fr;gap:4px;';

    function aBtn(label, fn, bg) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.style.cssText = [
        'padding:10px 4px', 'border-radius:8px', 'font-size:14px', 'font-weight:700',
        'border:1px solid rgba(255,255,255,.1)', 'cursor:pointer',
        'background:' + bg, 'color:#fff', '-webkit-tap-highlight-color:transparent',
      ].join(';');
      noBlur(b); b.addEventListener('click', fn); return b;
    }
    _actRow.appendChild(aBtn('Space', function () { ins(' '); }, 'rgba(255,255,255,.07)'));
    _actRow.appendChild(aBtn('↵',     function () { ins('\n'); }, 'rgba(109,94,252,.3)'));
    _actRow.appendChild(aBtn('⌫',     bsp,                       'rgba(251,113,133,.2)'));

    _panel.appendChild(tabRow);
    _panel.appendChild(grid);
    _panel.appendChild(_actRow);
    document.body.appendChild(_panel);
    switchTab('123');
  }

  /* ── Render keys for the active tab ────────────────────── */
  function switchTab(name) {
    _tab = name;

    /* Highlight active tab pill */
    _panel.querySelectorAll('[data-rktab]').forEach(function (t) {
      var on = t.getAttribute('data-rktab') === name;
      t.style.background  = on ? 'rgba(109,94,252,.28)' : 'rgba(255,255,255,.05)';
      t.style.color       = on ? '#b4aaff' : '#888';
      t.style.borderColor = on ? 'rgba(109,94,252,.55)' : 'rgba(255,255,255,.1)';
    });

    var grid = document.getElementById('ronyxKbGrid');
    grid.innerHTML = '';

    /* ══════════════════════════════════════════════════════
       ABC — full phone keyboard layout (flex rows, not grid)
       ══════════════════════════════════════════════════════ */
    if (name === 'ABC') {
      /* Hide the shared action row — ABC has its own Space/↵/⌫ */
      _actRow.style.display = 'none';
      grid.style.cssText = 'margin-bottom:0;';

      var KROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

      KROWS.forEach(function (row, ri) {
        var rDiv = document.createElement('div');
        rDiv.style.cssText = 'display:flex;gap:3px;margin-bottom:3px;';

        /* ⇧ Shift key — left of last row */
        if (ri === 2) {
          var shiftK = makeKey('⇧', function () { _caps = !_caps; switchTab('ABC'); },
            _caps ? 'rgba(109,94,252,.35)' : 'rgba(255,255,255,.1)', 'flex:1.5;font-size:18px;');
          if (_caps) shiftK.style.color = '#b4aaff';
          rDiv.appendChild(shiftK);
        }

        /* Indent: row 2 (ASDF) is inset half a key on each side */
        if (ri === 1) {
          var ind = document.createElement('div');
          ind.style.flex = '0.5'; rDiv.appendChild(ind);
        }

        /* Letter keys */
        row.split('').forEach(function (c) {
          var ch = _caps ? c : c.toLowerCase();
          var lk = makeKey(ch, (function (x) { return function () { ins(x); }; })(ch),
            null, 'flex:1;font-size:17px;min-height:44px;');
          rDiv.appendChild(lk);
        });

        /* Closing indent for row 2 */
        if (ri === 1) {
          var ind2 = document.createElement('div');
          ind2.style.flex = '0.5'; rDiv.appendChild(ind2);
        }

        /* ⌫ Backspace — right of last row */
        if (ri === 2) {
          var bkK = makeKey('⌫', bsp, 'rgba(251,113,133,.2)', 'flex:1.5;font-size:16px;min-height:44px;');
          rDiv.appendChild(bkK);
        }

        grid.appendChild(rDiv);
      });

      /* Bottom row: [123] [    space    ] [↵] */
      var bRow = document.createElement('div');
      bRow.style.cssText = 'display:flex;gap:3px;margin-top:3px;';

      var n123 = makeKey('123', function () { switchTab('123'); }, 'rgba(255,255,255,.1)', 'flex:1.5;font-size:12px;min-height:44px;');
      var spK  = makeKey('space', function () { ins(' '); }, 'rgba(255,255,255,.07)', 'flex:5;font-size:12px;color:rgba(255,255,255,.4);min-height:44px;');
      var retK = makeKey('↵', function () { ins('\n'); }, 'rgba(109,94,252,.3)', 'flex:1.5;font-size:18px;min-height:44px;');

      bRow.appendChild(n123); bRow.appendChild(spK); bRow.appendChild(retK);
      grid.appendChild(bRow);
      return;
    }

    /* ══════════════════════════════════════════════════════
       Non-ABC tabs — restore grid layout, show action row
       ══════════════════════════════════════════════════════ */
    _actRow.style.display = 'grid';

    /* Math uses 6 columns (36 items → 6 rows, no scroll needed)
       Greek/123 use 5 columns */
    var cols = name === 'Math' ? 6 : 5;
    grid.style.cssText = [
      'display:grid',
      'grid-template-columns:repeat(' + cols + ',1fr)',
      'gap:3px', 'margin-bottom:4px',
    ].join(';');

    TABS[name].forEach(function (pair) {
      var label = pair[0], val = pair[1];

      if (val === '__DEL') {
        grid.appendChild(makeKey(label, bsp, 'rgba(200,0,0,.4)'));
        return;
      }

      /* ∫ₐᵇ — inserts textbook-style definite integral template */
      if (val === '__INTLIM') {
        /* Key label uses HTML so sub/sup render correctly */
        var intBtn = makeKey(
          '<span style="font-size:17px;line-height:1">∫<sub style="font-size:9px;letter-spacing:0">a</sub><sup style="font-size:9px;letter-spacing:0;margin-left:-2px">b</sup></span>',
          function () {
            /* Insert textbook notation: ∫ₐᵇ f(x) dx — student replaces placeholders */
            ins('∫ₐᵇ f(x) dx');
          },
          'rgba(109,94,252,.22)'
        );
        grid.appendChild(intBtn);
        return;
      }

      grid.appendChild(makeKey(label, (function (v) { return function () { ins(v); }; })(val)));
    });
  }

  /* ── Show / hide ─────────────────────────────────────────── */
  function show() {
    build();
    _panel.style.transform = 'translateY(0)';
    var body = document.querySelector('.app__body');
    if (body) body.style.paddingBottom = '360px';
    setTimeout(function () {
      if (_ta) _ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }

  function hide() {
    if (!_panel) return;
    _panel.style.transform = 'translateY(100%)';
    var body = document.querySelector('.app__body');
    if (body) body.style.paddingBottom = '';
    _ta = null;
  }

  function toNative() {
    if (!_ta) return;
    _ta.dataset.rkyb = 'native';
    _ta.removeAttribute('inputmode');
    var tog = _ta._rkyToggle;
    if (tog) tog.textContent = '📐 Switch to Math Keyboard';
    hide();
    setTimeout(function () {
      if (_ta) { var t = _ta; _ta = null; t.focus(); }
    }, 30);
  }

  /* ── Attach to a textarea ───────────────────────────────── */
  function attach(ta) {
    ta.dataset.rkyb = 'math';

    ta.addEventListener('focus', function () {
      if (ta.dataset.rkyb === 'native') return;
      _ta = ta;
      ta.setAttribute('inputmode', 'none');
      show();
    });

    ta.addEventListener('blur', function () {
      setTimeout(function () {
        if (!_panel) return;
        if (_panel.contains(document.activeElement)) return;
        if (document.activeElement === ta) return;
        hide();
      }, 220);
    });

    /* Toggle below textarea */
    var tog = document.createElement('button');
    tog.type = 'button';
    tog.className = 'btn btn--ghost';
    tog.style.cssText = 'margin-top:8px;font-size:12px;color:var(--color-muted-2);';
    tog.textContent = '⌨ Using Math Keyboard — tap to switch to phone keyboard';
    ta._rkyToggle = tog;

    tog.addEventListener('click', function () {
      if (ta.dataset.rkyb === 'math') {
        ta.dataset.rkyb = 'native';
        ta.removeAttribute('inputmode');
        tog.textContent = '📐 Switch to Math Keyboard';
        hide();
        ta.focus();
      } else {
        ta.dataset.rkyb = 'math';
        ta.setAttribute('inputmode', 'none');
        tog.textContent = '⌨ Using Math Keyboard — tap to switch to phone keyboard';
        _ta = ta;
        ta.focus();
        show();
      }
    });

    ta.insertAdjacentElement('afterend', tog);
  }

  return { attach: attach };
})();
