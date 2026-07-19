# Launch Checklist

Everything is built and ready. Run through this checklist when you're ready to go public.

---

## Step 1 — Run the backend setup (one time)

```bash
cd admin-bundle/setup
node setup-launch.js
```

This creates 3 new Appwrite collections and adds `points` + `paystackEmail` to the users collection.

---

## Step 2 — Add Compete tab to the student nav

Open `js/ui.js`. Find the `tabs` array (around line 29) and add a new entry:

```js
const tabs = [
  { id: 'dashboard',     label: 'Home',    href: '/pages/student/dashboard.html',              d: 'M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z' },
  { id: 'exams',         label: 'Exams',   href: '/pages/student/exams.html',                  d: 'M5 3h14v18l-7-3-7 3z' },
  { id: 'compete',       label: 'Compete', href: '/pages/student/launch/competitions.html',     d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  { id: 'library',       label: 'Library', href: '/pages/student/library.html',                d: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5z' },
  { id: 'notifications', label: 'Alerts',  href: '/pages/student/notifications.html',          d: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0', notif: true },
  { id: 'profile',       label: 'Profile', href: '/pages/student/profile.html',                d: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0z' },
];
```

Note: the tabbar only fits 5 items well on small screens. You may want to replace one of the existing tabs or add a "More" dropdown.

---

## Step 3 — Add dashboard cards (optional but recommended)

In `pages/student/dashboard.html`, add these cards in the body:

```html
<!-- Compete card — add after the Library row-card -->
<a href="/pages/student/launch/competitions.html" class="row-card mt-4">
  <div class="row-card__icon">🏆</div>
  <div class="row-card__meta"><h4>Compete</h4><p>Join competitions and earn points</p></div>
  <span>›</span>
</a>

<a href="/pages/student/launch/study-rooms.html" class="row-card mt-4">
  <div class="row-card__icon">📹</div>
  <div class="row-card__meta"><h4>Study Rooms</h4><p>Join a group video study session</p></div>
  <span>›</span>
</a>
```

---

## Step 4 — Add admin nav links

In the admin sidebar (in `admin-bundle/js/admin-ui.js` or wherever the sidebar items are defined), add:

- **Competitions** → `/admin-bundle/pages/launch-competitions.html`
- **Study Rooms** → `/admin-bundle/pages/launch-rooms.html`

---

## Step 5 — Award points when students complete exams (optional boost)

In `pages/student/submitted.html`, after the scoring block runs, add:

```html
<script src="/js/launch-data.js"></script>
```

Then inside the scoring completion handler, call:

```js
// Award 5 points for completing any exam
await RonyxLaunch.awardPoints(5, 'Completed exam: ' + examTitle, 'exam_complete', examId);

// Award 10 bonus points if score is 80%+
if (pct >= 80) {
  await RonyxLaunch.awardPoints(10, 'Scored ' + pct + '% in ' + examTitle, 'bonus', examId);
}
```

---

## Step 6 — Enable Paystack (when you're ready to pay out)

1. Get your Paystack SECRET key and set up the Transfers API on your Paystack dashboard
2. Paste your Paystack PUBLIC key into `js/config.js`:
   ```js
   PAYSTACK_PUBLIC_KEY: 'pk_live_your_key_here',
   ```
3. Create `api/withdraw.js` (Vercel serverless function) to process payouts via the Paystack Transfer API
4. Deploy

The withdrawal button in the wallet is already wired — it just needs the API endpoint behind it.

---

## Step 7 — Deploy

```bash
node build.js
vercel --prod --yes
node build.js --restore
```

That's it. The features go live immediately after deploy.
