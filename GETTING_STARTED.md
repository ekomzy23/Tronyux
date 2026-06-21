# RUNYX — Getting Started (read this first)

Runyx is an AI-powered exam app. It's plain **HTML + CSS + JavaScript** (no build
step) with **Appwrite** as the backend. This guide tells you how everything links
together and how to make it talk to Appwrite.

---

## 1. What's in the box

```
runyx/
├── index.html              ← entry point (splash screen)
├── vercel.json             ← Vercel hosting config
├── .env.example            ← (for later server-side functions)
├── .gitignore
├── README.md
├── GETTING_STARTED.md      ← this file
│
├── css/                    ← ALL styling lives here (the design system)
│   ├── tokens.css          colors, fonts, spacing — change the look here
│   ├── reset.css           browser reset
│   ├── base.css            layout + the "app" phone frame
│   └── components.css      every button, card, input, nav, etc.
│
├── js/                     ← ALL logic lives here
│   ├── config.js           ⭐ YOUR settings (Appwrite endpoint, project ID)
│   ├── appwrite.js         auth: signup, login, OTP, logout
│   ├── data.js             reads/writes exams, attempts, results
│   ├── autosave.js         saves answers/notes in real time
│   ├── render.js           builds exam cards from data
│   ├── ui.js               student bottom nav + theme
│   ├── admin.js            (admin nav — ignore for now)
│   └── admin-data.js       (admin writes — ignore for now)
│
├── pages/
│   ├── auth/               welcome, signup, otp, login, forgot
│   ├── student/            dashboard, exam, results, study, profile… (the app)
│   └── admin/              admin panel (for later)
│
└── setup/                  ← one-time backend builder (Node scripts)
    ├── BACKEND.md          full Appwrite setup walkthrough
    ├── install.js          builds + seeds everything in one command
    ├── setup.js            creates database/collections/storage
    ├── seed.js             adds sample exams + questions
    ├── package.json
    └── .env.example        ← the SECRET key goes here (server side only)
```

---

## 2. Run it locally (no backend needed yet)

You must **serve** the folder — don't double-click the HTML (the `/css/...` and
`/js/...` paths only work when served).

```bash
cd runyx
npx serve .
```

Open the printed `http://localhost:...` link. You'll get the splash → welcome →
you can click through the entire app with demo data. Nothing is saved yet.

---

## 3. How the files link together

**Every page loads CSS in this exact order** (already done for you):

```html
<link rel="stylesheet" href="/css/tokens.css">
<link rel="stylesheet" href="/css/reset.css">
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/components.css">
```

**Pages that need the backend load JS in this order:**

```html
<script src="https://cdn.jsdelivr.net/npm/appwrite@16.0.2"></script>  <!-- Appwrite SDK -->
<script src="/js/config.js"></script>     <!-- your settings -->
<script src="/js/appwrite.js"></script>   <!-- auth functions -->
<script src="/js/data.js"></script>       <!-- data functions -->
```

So the data path is:
**page → `config.js` (your IDs) → `appwrite.js` / `data.js` → Appwrite cloud.**

---

## 4. Connect Appwrite (make it real)

This is the "see and receive from Appwrite" part. Two halves:

### A) Build the backend (one time)

Full detail in `setup/BACKEND.md`. Short version:

1. Create a project at https://cloud.appwrite.io → copy the **Project ID**.
2. Settings → Platforms → add a **Web** platform for `localhost` and your Vercel domain.
3. Overview → Integrations → API Keys → create a key (database/document/bucket scopes) → copy it.
4. In your terminal:
   ```bash
   cd setup
   cp .env.example .env       # paste endpoint, project ID, secret key
   npm install
   npm run backend            # ⭐ builds the whole database + sample data
   ```

### B) Turn the frontend on

Open **`js/config.js`** and set 3 things:

```js
window.RUNYX_CONFIG = {
  CONFIGURED: true,                              // ← flip to true
  ENDPOINT:   'https://cloud.appwrite.io/v1',    // ← your endpoint
  PROJECT_ID: 'paste_your_project_id_here',      // ← your project ID
  // (everything below is already filled in to match the setup script)
};
```

That's it. Now:
- **Sign up** creates a real account (you get a real 6-digit email code).
- **Log in / log out** are real.
- The **dashboard** loads real exams from your database.
- **Exam answers auto-save** to Appwrite as you type.
- **Submitting** records the attempt in the `attempts` collection.

> Important: the Project ID and endpoint in `config.js` are **safe to be public**.
> Security is enforced by Appwrite's allowed domains + per-collection permissions.
> The **secret API key** only ever lives in `setup/.env` (git-ignored) — never in the frontend.

---

## 5. What each JS file does (plain English)

| File           | Job |
|----------------|-----|
| `config.js`    | Your settings. The ONE file you edit to connect Appwrite. |
| `appwrite.js`  | `runyxSignup`, `runyxLogin`, `runyxVerifyOtp`, `runyxForgot`, `runyxLogout`. |
| `data.js`      | `RunyxData.listExams()`, `getExam()`, `startAttempt()`, `saveAnswers()`, `submitAttempt()`, `listResults()`, `uploadFile()`. |
| `autosave.js`  | Any field with `data-autosave="key"` saves itself (browser + cloud). |
| `render.js`    | Turns exam records into the cards you see on the dashboard. |
| `ui.js`        | Builds the bottom navigation and restores your theme. |

If `CONFIGURED` is `false`, all of these quietly fall back to demo behavior, so
the app always works while you're building.

---

## 6. Deploy to Vercel

```bash
npm i -g vercel
vercel          # first deploy (links/creates the project)
vercel --prod   # production
```

Or push the folder to GitHub and "Import" it in the Vercel dashboard — it's a
static site, no settings needed. After deploying, add your Vercel URL as a Web
platform in Appwrite (Step 4A.2) so the live site is allowed to connect.

---

## 7. Admin (later)

The admin panel exists at `/pages/admin/login.html` but is a separate phase.
Ignore it for now — focus on the student app above. We'll return to admin and to
the AI/auto-marking features (Appwrite Functions) when you're ready.
```
