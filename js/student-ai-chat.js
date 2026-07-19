/* ============================================================
   Ronyx AI Chat Widget  v1.0
   Floating conversational AI for student library + book pages.

   Chrome barriers handled:
   - SpeechRecognition stops after ~3s silence → auto-restart in onend
   - mic permission: clear error UI, no getUserMedia bloat
   - SpeechSynthesis silent cancellation on background → AudioContext keepalive
   - Long TTS responses cut off → chunked per sentence
   - Voices async load on Chrome → wait for voiceschanged event
   - Conflict with book page TTS bar → pause window.TTS on open
   ============================================================ */
;(function () {
  'use strict';

  var SR       = window.SpeechRecognition || window.webkitSpeechRecognition;
  var synth    = window.speechSynthesis || null;
  var _state   = 'idle'; // idle | listening | processing | speaking
  var _history = [];
  var _bookTitle = '', _bookCtx = '';
  var _rec = null, _listening = false, _transcript = '';
  var _ttsGen = 0, _keepCtx = null, _keepSrc = null;
  var MAX_HIST = 10;

  /* ── Boot ── */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _init);
  else _init();

  function _init() {
    _css();
    _html();
    window.rnxAI = { open: _open, close: _close, setBook: _setBook };
    /* Pick up book context if it was set before the widget loaded */
    if (window.RONYX_BOOK) _setBook(window.RONYX_BOOK.title, window.RONYX_BOOK.summary);
  }

  /* ── Public API ── */
  function _setBook(title, summary) {
    _bookTitle = title   || '';
    _bookCtx   = summary || '';
    var el = document.getElementById('rnx-subtitle');
    if (el && _bookTitle) el.textContent = 'Reading: ' + _bookTitle;
  }

  /* ── Open / Close ── */
  function _open() {
    var panel = document.getElementById('rnx-panel');
    if (!panel) return;
    /* Stop book TTS if playing */
    if (window.TTS && typeof TTS.stop === 'function') TTS.stop();
    panel.classList.add('open');
    if (_bookTitle) {
      var sub = document.getElementById('rnx-subtitle');
      if (sub) sub.textContent = 'Reading: ' + _bookTitle;
    }
    /* Greet on first open */
    if (_history.length === 0) {
      var g = _bookTitle
        ? 'Hi! I\'m Ronyx AI. You\'re studying "' + _bookTitle + '". What would you like me to explain or quiz you on?'
        : 'Hi! I\'m Ronyx AI, your study assistant. Ask me anything about your courses!';
      _addMsg('ai', g);
      _speak(g, function () { setTimeout(_startListening, 700); });
    }
  }

  function _close() {
    var panel = document.getElementById('rnx-panel');
    if (!panel) return;
    panel.classList.remove('open');
    _stopListening();
    _stopSpeaking(false);
    _setState('idle');
    _setStatus('');
  }

  /* ── State ── */
  function _setState(s) {
    _state = s;
    var btn   = document.getElementById('rnx-mic');
    var icon  = document.getElementById('rnx-mic-icon');
    var label = document.getElementById('rnx-mic-label');
    var fab   = document.getElementById('rnx-fab');
    if (!btn) return;
    btn.className = s;
    var MAP = {
      idle:       ['🎤', 'Tap to speak',           false],
      listening:  ['⏹',  'Listening… tap to stop', false],
      processing: ['⏳', 'Thinking…',               false],
      speaking:   ['🤚', 'Tap to interrupt',        true ],
    };
    var m = MAP[s] || MAP.idle;
    icon.innerHTML   = m[0];
    label.textContent = m[1];
    fab && (m[2] ? fab.classList.add('speaking') : fab.classList.remove('speaking'));
  }

  function _setStatus(t) {
    var el = document.getElementById('rnx-status');
    if (el) el.textContent = t;
  }

  /* ── Messages ── */
  function _addMsg(role, text) {
    var el = document.getElementById('rnx-msgs');
    if (!el) return;
    var d = document.createElement('div');
    d.className  = 'rnx-msg rnx-msg--' + role;
    d.textContent = text;
    el.appendChild(d);
    el.scrollTop  = el.scrollHeight;
    _history.push({ role: role === 'ai' ? 'assistant' : 'user', content: text });
    if (_history.length > MAX_HIST * 2) _history.splice(0, 2);
  }

  /* ── STT ── */
  function _startListening() {
    if (!SR) {
      _setStatus('Voice not supported — use ⌨ to type instead');
      return;
    }
    _stopSpeaking(false);
    _stopListening();
    _transcript = '';
    _listening  = true;
    _setState('listening');
    _setStatus('Listening…');

    _rec = new SR();
    _rec.lang           = 'en-US';
    _rec.continuous     = true;
    _rec.interimResults = true;

    var _interimEl = null;

    _rec.onresult = function (e) {
      var final = '', interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final   += e.results[i][0].transcript + ' ';
        else                       interim += e.results[i][0].transcript;
      }
      if (final) _transcript += final;
      var msgs = document.getElementById('rnx-msgs');
      if (!_interimEl && msgs) {
        _interimEl = document.createElement('div');
        _interimEl.className = 'rnx-msg rnx-msg--user rnx-msg--interim';
        msgs.appendChild(_interimEl);
      }
      if (_interimEl) _interimEl.textContent = _transcript + interim;
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    };

    /* Chrome kills recognition after silence — restart if still listening */
    _rec.onend = function () {
      if (!_listening) return;
      if (_transcript.trim()) {
        _submitSpeech(_transcript.trim());
      } else if (_state === 'listening') {
        setTimeout(function () {
          if (_listening && _state === 'listening') {
            try { _rec.start(); } catch (e) { /* already running */ }
          }
        }, 120);
      }
    };

    _rec.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'permission-denied') {
        _listening = false;
        _setState('idle');
        _setStatus('🔒 Mic blocked — tap the lock icon in your browser bar to allow it');
        return;
      }
      if (e.error === 'aborted') return; /* intentional, ignore */
      /* no-speech / audio-capture / network → restart silently */
      if (_listening && _state === 'listening') {
        setTimeout(function () { try { _rec.start(); } catch (e2) {} }, 220);
      }
    };

    try { _rec.start(); }
    catch (e) { _setStatus('Cannot access mic: ' + (e.message || e)); }
  }

  function _stopListening() {
    _listening = false;
    if (_rec) {
      try { _rec.abort(); } catch (e) {}
      _rec = null;
    }
  }

  function _submitSpeech(text) {
    _stopListening();
    var interim = document.querySelector('.rnx-msg--interim');
    if (interim) interim.remove();
    _addMsg('user', text);
    _callAI(text);
  }

  /* ── Toggle mic (tap handler) ── */
  function _toggleMic() {
    if (_state === 'processing') return;
    if (_state === 'speaking') {
      _stopSpeaking(true);
      setTimeout(_startListening, 300);
      return;
    }
    if (_state === 'listening') {
      var t = _transcript.trim();
      if (t) _submitSpeech(t);
      else   { _stopListening(); _setState('idle'); _setStatus(''); }
      return;
    }
    _startListening();
  }

  /* ── TTS (sentence-chunked + AudioContext keepalive) ── */
  function _keepAliveStart() {
    if (_keepSrc || !window.AudioContext && !window.webkitAudioContext) return;
    try {
      _keepCtx = _keepCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (_keepCtx.state === 'suspended') _keepCtx.resume();
      var buf  = _keepCtx.createBuffer(1, _keepCtx.sampleRate, _keepCtx.sampleRate);
      _keepSrc = _keepCtx.createBufferSource();
      _keepSrc.buffer = buf;
      _keepSrc.loop   = true;
      _keepSrc.connect(_keepCtx.destination);
      _keepSrc.start(0);
    } catch (e) {}
  }

  function _keepAliveStop() {
    if (!_keepSrc) return;
    try { _keepSrc.stop(); } catch (e) {}
    _keepSrc = null;
  }

  function _speak(text, onDone) {
    if (!synth) { onDone && onDone(); return; }
    _stopSpeaking(false);
    _setState('speaking');
    _setStatus('');
    _keepAliveStart();

    var g     = ++_ttsGen;
    var clean = text
      .replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,4} /g, '')
      .replace(/- /g, '').replace(/\n/g, ' ').trim();

    /* Split into sentence chunks — Chrome TTS cuts off > ~200 chars */
    var chunks = clean.match(/[^.!?]+[.!?]*/g) || [clean];
    chunks = chunks.map(function (c) { return c.trim(); }).filter(Boolean);
    var i = 0;

    function getVoice() {
      var vs = synth.getVoices();
      return vs.find(function (v) {
        return /natural|enhanced|premium/i.test(v.name) && v.lang.startsWith('en');
      }) || vs.find(function (v) { return v.lang.startsWith('en'); }) || null;
    }

    function next() {
      if (g !== _ttsGen) return; /* interrupted */
      if (i >= chunks.length) {
        _keepAliveStop();
        if (_state === 'speaking') {
          _setState('idle');
          _setStatus('');
        }
        onDone && onDone();
        return;
      }
      var u    = new SpeechSynthesisUtterance(chunks[i++]);
      u.rate   = 1.05;
      u.pitch  = 1.0;
      u.lang   = 'en-US';
      var v    = getVoice();
      if (v) u.voice = v;
      u.onend  = next;
      u.onerror = function (e) { if (e.error !== 'interrupted') next(); };
      synth.speak(u);
    }

    /* Chrome loads voices asynchronously */
    if (synth.getVoices().length === 0) {
      synth.addEventListener('voiceschanged', function onVC() {
        synth.removeEventListener('voiceschanged', onVC);
        next();
      });
    } else {
      next();
    }
  }

  function _stopSpeaking(setState) {
    ++_ttsGen;
    _keepAliveStop();
    if (synth) synth.cancel();
    if (setState !== false && _state === 'speaking') {
      _setState('idle');
      _setStatus('');
    }
  }

  /* ── API ── */
  async function _callAI(message) {
    _setState('processing');
    _setStatus('Ronyx is thinking…');
    try {
      var sess = _getKey();
      var hdrs = { 'Content-Type': 'application/json' };
      if (sess) hdrs['X-Session'] = sess;
      var resp = await fetch('/api/student-ai', {
        method:  'POST',
        headers: hdrs,
        body:    JSON.stringify({
          message:     message,
          bookTitle:   _bookTitle,
          bookContext: _bookCtx.slice(0, 500),
          history:     _history.slice(-8),
        }),
      });
      var data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'AI error');
      _addMsg('ai', data.reply || '');
      _speak(data.reply || '', function () {
        /* Auto-resume listening after AI finishes speaking */
        var panel = document.getElementById('rnx-panel');
        if (panel && panel.classList.contains('open')) {
          setTimeout(_startListening, 600);
        }
      });
    } catch (e) {
      _setState('idle');
      _setStatus('⚠ ' + e.message);
    }
  }

  function _getKey() {
    try {
      var fb  = JSON.parse(localStorage.getItem('cookieFallback') || '{}');
      var cfg = window.RONYX_CONFIG || {};
      return fb['a_session_' + (cfg.PROJECT_ID || '').toLowerCase()] || '';
    } catch (e) { return ''; }
  }

  /* ── Type input ── */
  function _toggleType() {
    var row = document.getElementById('rnx-type-row');
    if (!row) return;
    var show = row.classList.toggle('visible');
    if (show) {
      _stopListening();
      _setState('idle');
      setTimeout(function () {
        var inp = document.getElementById('rnx-type-inp');
        if (inp) inp.focus();
      }, 80);
    }
  }

  function _sendTyped() {
    var inp = document.getElementById('rnx-type-inp');
    if (!inp) return;
    var t = inp.value.trim();
    if (!t) return;
    inp.value = '';
    _addMsg('user', t);
    _callAI(t);
  }

  /* Expose handlers for inline onclick= */
  window._rnxMic      = _toggleMic;
  window._rnxType     = _toggleType;
  window._rnxSendType = _sendTyped;

  /* ── CSS ── */
  function _css() {
    var s = document.createElement('style');
    s.textContent = `
#rnx-fab{position:fixed;bottom:calc(72px + env(safe-area-inset-bottom,0px));right:16px;
  z-index:1200;width:52px;height:52px;border-radius:50%;
  background:linear-gradient(135deg,#6d5efc,#a78bfa);
  box-shadow:0 4px 22px rgba(109,94,252,.55);border:none;cursor:pointer;
  display:flex;align-items:center;justify-content:center;font-size:22px;
  transition:transform .15s;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
#rnx-fab:active{transform:scale(.88);}
#rnx-fab.has-tts{bottom:calc(142px + env(safe-area-inset-bottom,0px));}
#rnx-fab.speaking{animation:rnxPls 1.3s ease-in-out infinite;}
@keyframes rnxPls{0%,100%{box-shadow:0 4px 22px rgba(109,94,252,.55)}
  50%{box-shadow:0 4px 36px rgba(109,94,252,.95),0 0 0 12px rgba(109,94,252,.12)}}

#rnx-panel{position:fixed;bottom:0;left:0;right:0;z-index:1300;
  background:var(--color-bg,#0f0f1a);border-radius:22px 22px 0 0;
  box-shadow:0 -8px 48px rgba(0,0,0,.7);max-height:82vh;
  display:flex;flex-direction:column;
  transform:translateY(100%);transition:transform .3s cubic-bezier(.32,.72,0,1);
  pointer-events:none;}
#rnx-panel.open{transform:translateY(0);pointer-events:all;}
.rnx-handle{width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.12);margin:10px auto 5px;}
.rnx-hdr{display:flex;align-items:center;gap:10px;padding:0 16px 12px;
  border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;}
.rnx-av{width:34px;height:34px;border-radius:50%;
  background:linear-gradient(135deg,#6d5efc,#a78bfa);
  display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
.rnx-hdr-name{font-size:14px;font-weight:800;color:var(--color-text,#fff);}
.rnx-hdr-sub{font-size:11px;color:var(--color-muted,#888);margin-top:1px;max-width:220px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.rnx-hdr-x{margin-left:auto;background:none;border:none;color:var(--color-muted,#888);
  font-size:20px;cursor:pointer;padding:6px 8px;line-height:1;
  -webkit-tap-highlight-color:transparent;}
.rnx-msgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;
  gap:8px;min-height:100px;-webkit-overflow-scrolling:touch;}
.rnx-msg{max-width:84%;padding:10px 14px;border-radius:18px;font-size:14px;
  line-height:1.55;word-break:break-word;}
.rnx-msg--ai{background:rgba(109,94,252,.18);color:var(--color-text,#fff);
  border-bottom-left-radius:4px;align-self:flex-start;}
.rnx-msg--user{background:rgba(255,255,255,.09);color:var(--color-text,#fff);
  border-bottom-right-radius:4px;align-self:flex-end;}
.rnx-msg--interim{opacity:.5;font-style:italic;align-self:flex-end;}
.rnx-status{text-align:center;font-size:11px;font-weight:700;min-height:18px;
  color:var(--color-primary-2,#a78bfa);padding:4px 16px;flex-shrink:0;}
.rnx-ctrl{padding:10px 16px calc(16px + env(safe-area-inset-bottom,0px));
  display:flex;gap:8px;flex-shrink:0;border-top:1px solid rgba(255,255,255,.07);}
#rnx-mic{flex:1;padding:14px 10px;border-radius:16px;border:none;cursor:pointer;
  font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;
  gap:7px;transition:background .2s,transform .1s;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;}
#rnx-mic:active{transform:scale(.96);}
#rnx-mic.idle{background:rgba(109,94,252,.2);color:#a78bfa;}
#rnx-mic.listening{background:rgba(239,68,68,.18);color:#ef4444;animation:rnxBl .9s ease-in-out infinite;}
#rnx-mic.processing{background:rgba(255,255,255,.06);color:var(--color-muted,#888);}
#rnx-mic.speaking{background:rgba(52,211,153,.18);color:#34d399;}
@keyframes rnxBl{0%,100%{opacity:1}50%{opacity:.5}}
#rnx-kbdbtn{width:46px;height:46px;border-radius:14px;border:none;cursor:pointer;
  background:rgba(255,255,255,.07);color:var(--color-muted,#888);font-size:18px;
  display:flex;align-items:center;justify-content:center;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;flex-shrink:0;}
#rnx-type-row{display:none;gap:8px;padding:0 16px 10px;flex-shrink:0;}
#rnx-type-row.visible{display:flex;}
#rnx-type-inp{flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);
  border-radius:14px;padding:10px 14px;color:var(--color-text,#fff);font-size:14px;
  outline:none;font-family:inherit;}
#rnx-type-send{padding:10px 16px;border-radius:14px;border:none;cursor:pointer;
  background:linear-gradient(135deg,#6d5efc,#a78bfa);color:#fff;
  font-size:13px;font-weight:800;-webkit-tap-highlight-color:transparent;white-space:nowrap;}
`;
    document.head.appendChild(s);
  }

  /* ── HTML ── */
  function _html() {
    var fab = document.createElement('button');
    fab.id    = 'rnx-fab';
    fab.setAttribute('aria-label', 'Open Ronyx AI');
    fab.innerHTML = '&#10024;';
    fab.onclick   = _open;
    /* AI button hidden until API key is configured — do not append */
    // if (document.querySelector('.tts-bar')) fab.classList.add('has-tts');
    // document.body.appendChild(fab);

    var panel = document.createElement('div');
    panel.id  = 'rnx-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Ronyx AI Chat');
    panel.innerHTML =
      '<div class="rnx-handle"></div>' +
      '<div class="rnx-hdr">' +
        '<div class="rnx-av">&#10024;</div>' +
        '<div>' +
          '<div class="rnx-hdr-name">Ronyx AI</div>' +
          '<div class="rnx-hdr-sub" id="rnx-subtitle">Your study assistant</div>' +
        '</div>' +
        '<button class="rnx-hdr-x" onclick="rnxAI.close()" aria-label="Close">&#10005;</button>' +
      '</div>' +
      '<div class="rnx-msgs" id="rnx-msgs"></div>' +
      '<div class="rnx-status" id="rnx-status"></div>' +
      '<div id="rnx-type-row">' +
        '<input id="rnx-type-inp" type="text" placeholder="Type your question…" maxlength="500">' +
        '<button id="rnx-type-send" onclick="_rnxSendType()">Send</button>' +
      '</div>' +
      '<div class="rnx-ctrl">' +
        '<button id="rnx-mic" class="idle" onclick="_rnxMic()">' +
          '<span id="rnx-mic-icon">&#127908;</span>' +
          '<span id="rnx-mic-label">Tap to speak</span>' +
        '</button>' +
        '<button id="rnx-kbdbtn" onclick="_rnxType()" title="Type instead">&#9000;</button>' +
      '</div>';
    document.body.appendChild(panel);

    panel.querySelector('#rnx-type-inp').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') _sendTyped();
    });
  }

})();
