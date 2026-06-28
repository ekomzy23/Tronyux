/* ============================================================
   RONYX · autosave.js
   Real-time auto-save for any text field.

   Layer 1 (works now): saves to the browser instantly → survives
                        refresh / close. This is offline-first.
   Layer 2 (optional):  when Appwrite is configured, the same text
                        is also saved to the cloud (debounced).

   HOW TO USE on any page:
     <textarea data-autosave="exam:ds-final:q25"></textarea>
     <span class="save-status" data-status></span>
     <script src="https://cdn.jsdelivr.net/npm/appwrite@16.0.2"></script>
     <script src="/js/config.js"></script>
     <script src="/js/autosave.js"></script>

   The data-autosave value is a unique KEY for that field.
   ============================================================ */

(function () {
  const cfg = window.RONYX_CONFIG || { CONFIGURED: false };

  // Optional cloud client (only if configured + SDK present)
  let databases = null;
  if (cfg.CONFIGURED && window.Appwrite && cfg.COLLECTIONS && cfg.COLLECTIONS.drafts) {
    const client = new Appwrite.Client()
      .setEndpoint(cfg.ENDPOINT)
      .setProject(cfg.PROJECT_ID);
    databases = new Appwrite.Databases(client);
  }

  // turn a key into a safe localStorage + document id
  const idFor = key => 'ronyx_draft_' + key.replace(/[^a-zA-Z0-9_-]/g, '_');

  function setStatus(el, text, color) {
    if (!el) return;
    el.textContent = text;
    el.style.color = color;
  }

  async function saveToCloud(key, value) {
    if (!databases) return;
    const docId = idFor(key);
    try {
      // try to update an existing draft…
      await databases.updateDocument(cfg.DATABASE_ID, cfg.COLLECTIONS.drafts, docId, {
        key, value, updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      // …or create it the first time
      try {
        await databases.createDocument(cfg.DATABASE_ID, cfg.COLLECTIONS.drafts, docId, {
          key, value, updatedAt: new Date().toISOString(),
        });
      } catch (err) { /* offline — localStorage already has it */ }
    }
  }

  // wire every field that opts in
  document.querySelectorAll('[data-autosave]').forEach(field => {
    const key = field.getAttribute('data-autosave');
    const statusEl = field.parentElement.querySelector('[data-status]')
                  || document.querySelector(`[data-status][data-for="${field.id}"]`);

    // 1. restore saved text on load
    const saved = localStorage.getItem(idFor(key));
    if (saved !== null) field.value = saved;
    setStatus(statusEl, saved ? 'Saved' : '', 'var(--color-muted-2)');

    // 2. save as the user types (debounced)
    let t;
    field.addEventListener('input', () => {
      setStatus(statusEl, 'Saving…', 'var(--color-muted)');
      clearTimeout(t);
      t = setTimeout(() => {
        localStorage.setItem(idFor(key), field.value);   // instant local save
        saveToCloud(key, field.value);                    // cloud (if configured)
        setStatus(statusEl, '✓ Saved', 'var(--color-success)');
      }, 600);
    });
  });
})();
