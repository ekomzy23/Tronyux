/**
 * RONYX · build.js
 * 1. Stamps every HTML file with a fresh cache-bust version (?v=<hash>)
 * 2. Obfuscates critical JS files before a production deploy.
 *
 * Usage:
 *   npm install          (first time — installs javascript-obfuscator)
 *   node build.js        — stamp HTML + obfuscate JS
 *   node build.js --restore — restore obfuscated JS from backups
 *
 * Deploy workflow:
 *   1. node build.js
 *   2. vercel --prod --yes
 *   3. node build.js --restore   ← restores JS source so you can keep editing
 *
 * Note: HTML version stamps are left in place after restore — they have no
 * functional impact locally and will be re-stamped on the next build anyway.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

/* Files to obfuscate (relative to project root) */
const TARGETS = [
  'js/data.js',
  'js/pdfviewer.js',
  'js/ocrengine.js',
  'js/autosave.js',
  'js/scikeyboard.js',
  'js/onboarding.js',
];

const RESTORE = process.argv.includes('--restore');

/* ── Restore mode ────────────────────────────────────────── */
if (RESTORE) {
  let ok = 0;
  TARGETS.forEach(function(rel) {
    const src  = path.resolve(rel);
    const back = src.replace(/\.js$/, '.orig.js');
    if (fs.existsSync(back)) {
      fs.copyFileSync(back, src);
      fs.unlinkSync(back);
      console.log('✓ restored', rel);
      ok++;
    }
  });
  console.log('\n' + ok + ' file(s) restored. Source code is back to normal.');
  process.exit(0);
}

/* ── Version stamp ───────────────────────────────────────────
   Generate a short hash from the current timestamp.
   Every build gets a unique ?v=<hash>, forcing browsers to
   fetch fresh JS and CSS even if the URL path is the same.
   ──────────────────────────────────────────────────────────── */
const VER      = Date.now().toString(36); // e.g. "m2xk4a9"
const ROOT     = __dirname;
const SKIP     = new Set(['node_modules', '.git', '.vercel', '.next']);

function stampDir(dir) {
  let count = 0;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch(e) { return 0; }

  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += stampDir(full);
    } else if (entry.name.endsWith('.html')) {
      const src = fs.readFileSync(full, 'utf8');
      /* Replace ?v=<anything> with the new version */
      const out = src.replace(/\?v=[^"'&\s]+/g, '?v=' + VER);
      if (out !== src) {
        fs.writeFileSync(full, out, 'utf8');
        count++;
      }
    }
  }
  return count;
}

const stamped = stampDir(ROOT);
console.log('✓ stamped ' + stamped + ' HTML file(s) → ?v=' + VER);

/* ── Obfuscate mode ──────────────────────────────────────── */
let JsObfuscator;
try {
  JsObfuscator = require('javascript-obfuscator');
} catch(e) {
  console.error('ERROR: javascript-obfuscator not found.');
  console.error('Run:  npm install  first, then retry.');
  process.exit(1);
}

const OPTIONS = {
  compact:                    true,
  controlFlowFlattening:      true,
  controlFlowFlatteningThreshold: 0.6,
  deadCodeInjection:          true,
  deadCodeInjectionThreshold: 0.3,
  identifierNamesGenerator:   'hexadecimal',
  log:                        false,
  renameGlobals:              false,
  rotateStringArray:          true,
  selfDefending:              false,   /* off: breaks strict-mode IIFEs */
  stringArray:                true,
  stringArrayEncoding:        ['base64'],
  stringArrayThreshold:       0.75,
  transformObjectKeys:        false,
  disableConsoleOutput:       false,
  target:                     'browser',
};

let obfCount = 0;

const onVercel = !!process.env.VERCEL;

TARGETS.forEach(function(rel) {
  const src = path.resolve(rel);
  if (!fs.existsSync(src)) {
    console.log('– skipped (not found):', rel);
    return;
  }

  let sourceCode;
  if (onVercel) {
    sourceCode = fs.readFileSync(src, 'utf8');
  } else {
    const back = src.replace(/\.js$/, '.orig.js');
    if (!fs.existsSync(back)) {
      fs.copyFileSync(src, back);
    }
    sourceCode = fs.readFileSync(back, 'utf8');
  }

  const result = JsObfuscator.obfuscate(sourceCode, OPTIONS);
  fs.writeFileSync(src, result.getObfuscatedCode(), 'utf8');
  console.log('✓ obfuscated', rel,
    '(' + Math.round(fs.statSync(src).size / 1024) + ' KB)');
  obfCount++;
});

console.log('\n' + obfCount + ' file(s) obfuscated and ready to deploy.');
console.log('\nNext steps:');
console.log('  vercel --prod --yes');
console.log('  node build.js --restore   ← run this AFTER deploying');
