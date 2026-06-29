/* ============================================================
   RONYX · pdfviewer.js  v2
   In-app PDF renderer — PDF.js renders pages as canvas elements.
   Extracts text for TTS. Loaded on demand.
============================================================ */
(function () {
  'use strict';

  var PDFLIB = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFWKR = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  function loadLib() {
    return new Promise(function (res, rej) {
      if (window.pdfjsLib) { res(window.pdfjsLib); return; }
      var s = document.createElement('script');
      s.src = PDFLIB;
      s.crossOrigin = 'anonymous';
      s.onload = function () {
        try {
          /* Try CDN worker first */
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWKR;
        } catch(e) {
          /* If worker setup fails, run in-thread (slower but works) */
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = '';
        }
        res(window.pdfjsLib);
      };
      s.onerror = function () { rej(new Error('PDF engine failed to load. Check your internet connection.')); };
      document.head.appendChild(s);
    });
  }

  /* render(blobUrl, container, onProgress) → Promise<{text, canvases, pages}> */
  async function render(blobUrl, container, onProgress) {
    function prog(pct, label) { onProgress && onProgress({ pct: pct, label: label }); }

    prog(3, 'Loading PDF engine...');
    var pdfjs = await loadLib();

    prog(8, 'Opening document...');

    var loadTask = pdfjs.getDocument({ url: blobUrl, verbosity: 0 });
    var pdf = await loadTask.promise;
    var total   = pdf.numPages;
    var allText = '';
    var canvases = [];

    for (var i = 1; i <= total; i++) {
      prog(Math.round(8 + (i / total) * 82), 'Rendering page ' + i + ' of ' + total + '...');

      var page = await pdf.getPage(i);

      /* Use device pixel ratio for sharp rendering, capped at 2 for performance on mobile */
      var dpr   = Math.min(window.devicePixelRatio || 1, 2);
      var scale = dpr * 1.5;
      var vp    = page.getViewport({ scale: scale });

      var canvas  = document.createElement('canvas');
      canvas.width  = vp.width;
      canvas.height = vp.height;
      /* CSS width fills container; height auto-scales proportionally */
      canvas.style.cssText = 'width:100%;height:auto;display:block;margin-bottom:3px;border-radius:4px;background:#fff;';
      canvas.setAttribute('data-page', i);

      var ctx = canvas.getContext('2d');
      if (!ctx) { canvases.push(canvas); continue; } /* skip if canvas not supported */

      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      container.appendChild(canvas);
      canvases.push(canvas);

      /* Text extraction for TTS */
      try {
        var tc = await page.getTextContent();
        allText += tc.items.map(function (it) { return it.str; }).join(' ') + '\n\n';
      } catch(e) { /* ignore text extraction errors on individual pages */ }
    }

    prog(100, total + ' page' + (total !== 1 ? 's' : '') + ' loaded');
    return { text: allText.trim(), canvases: canvases, pages: total };
  }

  window.RonyxPDF = { render: render };
})();
