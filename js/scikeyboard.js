/* ============================================================
   RUNYX · scikeyboard.js
   A keyboard for any textarea. Tap "Keyboard" → choose
   MATH or SCIENTIFIC → pick symbols. Live KaTeX preview.

   Usage:
     <textarea id="answer"></textarea>
     <script src="/js/scikeyboard.js"></script>
     <script>RunyxSciKeyboard.attach(document.getElementById('answer'));</script>
   ============================================================ */

window.RunyxSciKeyboard = (function () {

  // MODE → sub-tab → [ [label, latex] ]
  const MODES = {
    Math: {
      Basic: [
        ['+','+'],['−','-'],['×','\\times'],['÷','\\div'],['=','='],['≠','\\neq'],
        ['<','<'],['>','>'],['≤','\\leq'],['≥','\\geq'],['±','\\pm'],['%','\\%'],
        ['( )','()'],['[ ]','[]'],['√','\\sqrt{}'],['xⁿ','^{}'],['x₍ᵢ₎','_{}'],['½','\\frac{}{}'],
      ],
      Greek: [
        ['α','\\alpha'],['β','\\beta'],['γ','\\gamma'],['δ','\\delta'],['ε','\\epsilon'],['θ','\\theta'],
        ['λ','\\lambda'],['μ','\\mu'],['π','\\pi'],['ρ','\\rho'],['σ','\\sigma'],['φ','\\phi'],
        ['ω','\\omega'],['Δ','\\Delta'],['Σ','\\Sigma'],['Ω','\\Omega'],['Φ','\\Phi'],['Π','\\Pi'],
      ],
      Calculus: [
        ['∫','\\int'],['∫ab','\\int_{a}^{b}'],['∬','\\iint'],['∮','\\oint'],['∂','\\partial'],['∇','\\nabla'],
        ['Σ','\\sum_{}^{}'],['∏','\\prod'],['lim','\\lim_{x \\to }'],['d/dx','\\frac{d}{dx}'],['→','\\to'],['∞','\\infty'],
      ],
    },
    Scientific: {
      Chemistry: [
        ['→','\\rightarrow'],['⇌','\\rightleftharpoons'],['↑','\\uparrow'],['↓','\\downarrow'],
        ['H₂O','H_2O'],['CO₂','CO_2'],['x₂','_2'],['x₃','_3'],['x₄','_4'],
        ['⁺','^{+}'],['⁻','^{-}'],['²⁺','^{2+}'],['Δ','\\Delta'],['⁰','^{\\circ}'],['·','\\cdot'],
      ],
      Physics: [
        ['ℏ','\\hbar'],['λ','\\lambda'],['ν','\\nu'],['ω','\\omega'],['Ω','\\Omega'],['μ','\\mu'],
        ['ε₀','\\epsilon_0'],['∝','\\propto'],['∴','\\therefore'],['∆','\\Delta'],['vec','\\vec{}'],['hat','\\hat{}'],
        ['°','^{\\circ}'],['×10ⁿ','\\times 10^{}'],['√','\\sqrt{}'],['½','\\frac{}{}'],
      ],
      Symbols: [
        ['∑','\\sum'],['∫','\\int'],['√','\\sqrt{}'],['π','\\pi'],['∞','\\infty'],['≈','\\approx'],
        ['≡','\\equiv'],['∈','\\in'],['∉','\\notin'],['⊂','\\subset'],['∪','\\cup'],['∩','\\cap'],
        ['∀','\\forall'],['∃','\\exists'],['¬','\\neg'],['∧','\\land'],['∨','\\lor'],['→','\\to'],
      ],
    },
  };

  function insert(ta, text) {
    const s = ta.selectionStart, e = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
    const brace = text.indexOf('{}');
    const caret = brace >= 0 ? s + brace + 1 : s + text.length;
    ta.selectionStart = ta.selectionEnd = caret;
    ta.dispatchEvent(new Event('input'));
    ta.focus();
  }

  function attach(ta) {
    // live preview
    const prev = document.createElement('div'); prev.className = 'eqn-preview';

    // toggle button
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn--ghost'; btn.style.marginTop = '12px';
    btn.textContent = '⌨  Keyboard';

    // panel
    const panel = document.createElement('div'); panel.className = 'scikb';
    const modeRow = document.createElement('div'); modeRow.className = 'scikb__tabs';
    const subRow  = document.createElement('div'); subRow.className = 'scikb__tabs';
    const grid    = document.createElement('div'); grid.className = 'scikb__grid';
    panel.append(modeRow, subRow, grid);

    let mode = 'Math';

    function drawKeys(sub) {
      grid.innerHTML = '';
      MODES[mode][sub].forEach(([label, tex]) => {
        const k = document.createElement('button');
        k.type = 'button'; k.className = 'scikb__key'; k.textContent = label;
        k.addEventListener('click', () => insert(ta, tex));
        grid.appendChild(k);
      });
      [...subRow.children].forEach(t => t.classList.toggle('is-active', t.textContent === sub));
    }
    function drawSubs() {
      subRow.innerHTML = '';
      const subs = Object.keys(MODES[mode]);
      subs.forEach((name, i) => {
        const t = document.createElement('button');
        t.type = 'button'; t.className = 'scikb__tab' + (i === 0 ? ' is-active' : '');
        t.textContent = name;
        t.addEventListener('click', () => drawKeys(name));
        subRow.appendChild(t);
      });
      drawKeys(subs[0]);
    }
    function setMode(m) {
      mode = m;
      [...modeRow.children].forEach(t => t.classList.toggle('is-active', t.dataset.mode === m));
      drawSubs();
    }

    // mode buttons (Math / Scientific)
    Object.keys(MODES).forEach((m, i) => {
      const t = document.createElement('button');
      t.type = 'button'; t.className = 'scikb__tab' + (i === 0 ? ' is-active' : '');
      t.dataset.mode = m; t.textContent = m === 'Math' ? '📐 Math' : '🔬 Scientific';
      t.style.fontWeight = '600';
      t.addEventListener('click', () => setMode(m));
      modeRow.appendChild(t);
    });

    function render() {
      if (window.katex) {
        try { katex.render(ta.value || '\\;', prev, { throwOnError: false, displayMode: true }); return; }
        catch (e) {}
      }
      prev.textContent = ta.value;
    }
    ta.addEventListener('input', render);
    btn.addEventListener('click', () => panel.classList.toggle('open'));

    ta.insertAdjacentElement('afterend', prev);
    prev.insertAdjacentElement('afterend', btn);
    btn.insertAdjacentElement('afterend', panel);

    setMode('Math');
    render();
  }

  return { attach };
})();
