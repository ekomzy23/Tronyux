/* ============================================================
   RONYX · pdfviewer.js  v1
   In-app PDF renderer — PDF.js renders pages as canvas elements
   inside the Ronyx reader. Extracts text for TTS.
   Loaded on demand (not on every page).
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
      s.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWKR;
        res(window.pdfjsLib);
      };
      s.onerror = function () { rej(new Error('PDF.js load failed')); };
      document.head.appendChild(s);
    });
  }

  /* render(blobUrl, container, onProgress) → Promise<{text, canvases, pages}>
     blobUrl   : object URL pointing to the PDF blob
     container : DOM element to append canvas elements into
     onProgress: function({pct, label}) for progress updates          */
  async function render(blobUrl, container, onProgress) {
    function prog(pct, label) { onProgress && onProgress({ pct: pct, label: label }); }

    prog(3, 'Loading PDF engine…');
    var pdfjs = await loadLib();

    prog(8, 'Opening document…');
    var pdf = await pdfjs.getDocument({ url: blobUrl, verbosity: 0 }).promise;
    var total = pdf.numPages;
    var allText = '';
    var canvases = [];

    for (var i = 1; i <= total; i++) {
      prog(Math.round(8 + (i / total) * 82), 'Rendering page ' + i + ' of ' + total + '…');

      var page = await pdf.getPage(i);
      /* Scale: use 1.5 × device pixel ratio, capped at 3 for performance */
      var scale = Math.min((window.devicePixelRatio || 1) * 1.5, 3);
      var vp = page.getViewport({ scale: scale });

      var canvas = document.createElement('canvas');
      canvas.width  = vp.width;
      canvas.height = vp.height;
      canvas.style.cssText = 'width:100%;display:block;margin-bottom:3px;border-radius:4px;';
      canvas.setAttribute('data-page', i);

      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      container.appendChild(canvas);
      canvases.push(canvas);

      /* Text extraction */
      var tc = await page.getTextContent();
      allText += tc.items.map(function (it) { return it.str; }).join(' ') + '\n\n';
    }

    prog(100, total + ' page' + (total !== 1 ? 's' : '') + ' loaded');
    return { text: allText.trim(), canvases: canvases, pages: total };
  }

  window.RonyxPDF = { render: render };
})();
