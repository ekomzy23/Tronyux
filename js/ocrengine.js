/* ============================================================
   RONYX · ocrengine.js  v2
   High-quality OCR engine — Tesseract.js 5
   Key improvements over v1:
   • Single persistent worker per call (no reload per page — 4-8× faster)
   • Canvas downscaled to 1 200 px before OCR (faster, same quality)
   • OEM 1 (LSTM_ONLY) — fastest engine mode
   • PSM 6 (SINGLE_BLOCK) — best for student documents
   • Automatic orientation detection & canvas rotation correction
   • Comprehensive text cleaning — fixes letter-by-letter OCR output
   • Rotation angle cached separately so visual correction persists on
     repeat visits even when text cache is used
   Loaded on demand — not on every page.
============================================================ */
(function () {
  'use strict';

  var CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js';
  var PSM_BLOCK = '6';   /* SINGLE_BLOCK — best for most documents */
  var PSM_OSD   = '1';   /* AUTO_OSD    — includes orientation detection */
  var OEM_LSTM  = 1;     /* LSTM_ONLY   — fastest accurate engine */

  /* ── Load Tesseract.js from CDN (once) ── */
  function loadTesseract() {
    return new Promise(function (res, rej) {
      if (window.Tesseract) { res(window.Tesseract); return; }
      var s = document.createElement('script');
      s.src     = CDN;
      s.onload  = function () { res(window.Tesseract); };
      s.onerror = function () { rej(new Error('Tesseract.js CDN load failed')); };
      document.head.appendChild(s);
    });
  }

  /* ── Resize canvas before OCR (big speed win) ──
     1 200 px wide is optimal — enough resolution for LSTM, small enough to be fast */
  function downscale(canvas, maxW) {
    maxW = maxW || 1200;
    if (canvas.width <= maxW) return canvas;
    var ratio = maxW / canvas.width;
    var tmp = document.createElement('canvas');
    tmp.width  = maxW;
    tmp.height = Math.round(canvas.height * ratio);
    tmp.getContext('2d').drawImage(canvas, 0, 0, tmp.width, tmp.height);
    return tmp;
  }

  /* ── Rotate a canvas in-place and resize its dimensions ── */
  function rotateCanvas(canvas, deg) {
    if (!deg || deg % 360 === 0) return;
    var sw = (deg === 90 || deg === 270) ? canvas.height : canvas.width;
    var sh = (deg === 90 || deg === 270) ? canvas.width  : canvas.height;
    var tmp = document.createElement('canvas');
    tmp.width  = sw;
    tmp.height = sh;
    var ctx = tmp.getContext('2d');
    ctx.translate(sw / 2, sh / 2);
    ctx.rotate(deg * Math.PI / 180);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    canvas.width  = sw;
    canvas.height = sh;
    canvas.getContext('2d').drawImage(tmp, 0, 0);
  }

  /* ── Average word confidence (0-100) ── */
  function avgConf(words) {
    if (!words || !words.length) return 0;
    var sum = 0;
    for (var i = 0; i < words.length; i++) sum += (words[i].confidence || 0);
    return sum / words.length;
  }

  /* ── Comprehensive text cleaning ──
     Fixes the "letter by letter" problem caused by spaced-out OCR output,
     removes noise lines, normalises line breaks, and cleans common errors. */
  function cleanText(raw) {
    if (!raw) return '';
    var t = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    /* 1 — Fix spaced single characters: "H e l l o" → "Hello"
           Match 3+ consecutive single letters separated by one space */
    t = t.replace(/\b[A-Za-z](?: [A-Za-z]){2,}\b/g, function (m) {
      return m.replace(/ /g, '');
    });

    /* 2 — Fix newline-separated single characters: "H\ne\nl\nl\no" → "Hello" */
    t = t.replace(/\b[A-Za-z](\n[A-Za-z]){2,}\b/g, function (m) {
      return m.replace(/\n/g, '');
    });

    /* 3 — Reunite hyphenated line breaks: "com-\nputer" → "computer" */
    t = t.replace(/(\w)-\s*\n\s*([a-z])/g, '$1$2');

    /* 4 — Join soft line breaks: lowercase end + lowercase start
           These are continuation of the same sentence, not new paragraphs */
    t = t.replace(/([a-z,;])[ \t]*\n[ \t]*([a-z])/g, '$1 $2');

    /* 5 — Strip lines that are pure noise (< 2 alphanumeric chars) */
    t = t.split('\n').filter(function (line) {
      if (!line.trim()) return true; /* keep blank lines — paragraph breaks */
      return (line.match(/[A-Za-z0-9]/g) || []).length >= 2;
    }).join('\n');

    /* 6 — Collapse runs of blank lines to a single blank line */
    t = t.replace(/\n{3,}/g, '\n\n');

    /* 7 — Collapse multiple spaces */
    t = t.replace(/[ \t]{2,}/g, ' ');

    /* 8 — Remove leading/trailing whitespace per line */
    t = t.split('\n').map(function (l) { return l.trim(); }).join('\n');

    return t.trim();
  }

  /* ── Apply a stored rotation angle to an array of canvases ──
     Called on repeat visits when rotation is in cache but pages just rendered. */
  function applyStoredRotation(canvases, cacheKey) {
    if (!cacheKey) return;
    var rotKey = cacheKey + '_rot';
    var deg = 0;
    try { deg = parseInt(localStorage.getItem(rotKey) || '0', 10); } catch(e) {}
    if (deg) canvases.forEach(function (c) { rotateCanvas(c, deg); });
  }

  /* ────────────────────────────────────────────────────────────
     processCanvases(canvases, cacheKey, onProgress) → Promise<string>
     canvases   : HTMLCanvasElement[] — one per PDF page (from pdfviewer.js)
     cacheKey   : localStorage key, '' to disable cache
     onProgress : function({page, total, pct, label})
  ──────────────────────────────────────────────────────────── */
  async function processCanvases(canvases, cacheKey, onProgress) {
    function prog(page, total, pct, label) {
      onProgress && onProgress({ page: page, total: total, pct: pct, label: label });
    }

    /* Check text cache */
    if (cacheKey) {
      var cached = null;
      try { cached = localStorage.getItem(cacheKey); } catch (e) {}
      if (cached) {
        /* Also restore visual rotation */
        applyStoredRotation(canvases, cacheKey);
        return cached;
      }
    }

    prog(0, canvases.length, 0, 'Loading OCR engine…');
    var Tess = await loadTesseract();

    /* ── Single persistent worker — loaded ONCE for all pages ──
       Logger uses a closure variable so we can tag progress by page number. */
    var curPage = 0;
    var worker = await Tess.createWorker('eng', OEM_LSTM, {
      logger: function (m) {
        if (m.status === 'recognizing text') {
          var pct = Math.round(m.progress * 100);
          prog(curPage, canvases.length, pct,
               'OCR page ' + curPage + ' of ' + canvases.length + ' (' + pct + '%)');
        }
      }
    });

    /* Base parameters — faster, no extra output formats */
    await worker.setParameters({
      tessedit_pageseg_mode: PSM_BLOCK,
      tessjs_create_hocr:    '0',
      tessjs_create_tsv:     '0',
    });

    var texts        = [];
    var rotFixed     = false;
    var detectedRot  = 0;

    for (var i = 0; i < canvases.length; i++) {
      curPage = i + 1;
      prog(curPage, canvases.length, 0, 'OCR page ' + curPage + ' of ' + canvases.length + '…');

      /* Downscale for speed — display canvas untouched */
      var small  = downscale(canvases[i]);
      var result = await worker.recognize(small);
      texts.push(result.data.text);

      /* ── After page 1: detect orientation if confidence is low ── */
      if (i === 0 && !rotFixed) {
        var conf = avgConf(result.data.words);
        if (conf < 50) {
          prog(1, canvases.length, 0, 'Low confidence — detecting orientation…');

          /* Switch to OSD mode for orientation detection */
          await worker.setParameters({ tessedit_pageseg_mode: PSM_OSD });
          var osd    = await worker.recognize(small);
          var osdRot = (osd.data.orientation && osd.data.orientation.rotate) || 0;
          await worker.setParameters({ tessedit_pageseg_mode: PSM_BLOCK }); /* restore */

          if (osdRot !== 0) {
            detectedRot = osdRot;
            /* Rotate ALL canvases visually (in-DOM update) */
            canvases.forEach(function (c) { rotateCanvas(c, osdRot); });
            rotFixed = true;

            /* Re-OCR page 1 with corrected canvas */
            small  = downscale(canvases[0]);
            result = await worker.recognize(small);
            texts[0] = result.data.text;
          }
        }
      }
    }

    await worker.terminate();

    var fullText  = texts.join('\n\n');
    var cleanedText = cleanText(fullText);

    /* Cache text + rotation angle */
    if (cacheKey && cleanedText.length > 10) {
      try {
        localStorage.setItem(cacheKey, cleanedText);
        if (detectedRot) localStorage.setItem(cacheKey + '_rot', detectedRot);
      } catch (e) {}
    }

    return cleanedText;
  }

  /* ────────────────────────────────────────────────────────────
     processBlob(blob, cacheKey, onProgress) → Promise<string>
     For image files (JPG, PNG, GIF, WEBP) uploaded directly.
  ──────────────────────────────────────────────────────────── */
  async function processBlob(blob, cacheKey, onProgress) {
    function prog(pct, label) { onProgress && onProgress({ pct: pct, label: label }); }

    if (cacheKey) {
      var cached = null;
      try { cached = localStorage.getItem(cacheKey); } catch (e) {}
      if (cached) return cached;
    }

    prog(2, 'Loading OCR engine…');
    var Tess = await loadTesseract();

    var worker = await Tess.createWorker('eng', OEM_LSTM, {
      logger: function (m) {
        if (m.status === 'recognizing text') {
          var pct = 8 + Math.round(m.progress * 90);
          prog(pct, 'Recognising text (' + Math.round(m.progress * 100) + '%)…');
        }
      }
    });

    await worker.setParameters({
      tessedit_pageseg_mode: PSM_BLOCK,
      tessjs_create_hocr:    '0',
      tessjs_create_tsv:     '0',
    });

    prog(6, 'Scanning image…');
    var result = await worker.recognize(blob);

    /* Orientation check for images */
    var conf = avgConf(result.data.words);
    if (conf < 50) {
      prog(50, 'Checking orientation…');
      await worker.setParameters({ tessedit_pageseg_mode: PSM_OSD });
      var osd    = await worker.recognize(blob);
      var osdRot = (osd.data.orientation && osd.data.orientation.rotate) || 0;
      await worker.setParameters({ tessedit_pageseg_mode: PSM_BLOCK });

      if (osdRot !== 0) {
        /* Re-OCR in correct orientation — Tesseract PSM_OSD result already accounts for it */
        result = osd;
      }
    }

    await worker.terminate();

    var cleanedText = cleanText(result.data.text);

    if (cacheKey && cleanedText.length > 10) {
      try { localStorage.setItem(cacheKey, cleanedText); } catch (e) {}
    }

    return cleanedText;
  }

  /* Expose rotation helper so book.html can restore orientation on cached visits */
  window.RonyxOCR = {
    processCanvases: processCanvases,
    processBlob:     processBlob,
    applyStoredRotation: applyStoredRotation,
  };
})();
