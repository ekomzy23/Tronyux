# RONYX — Appwrite Backend Setup

Follow these once. Takes ~15 minutes. After this, signup/login/data are live.

---

## Step 1 — Create the project (Appwrite Console)

1. Go to https://cloud.appwrite.io and sign in.
2. **Create project** → name it `Ronyx`. Copy the **Project ID** (Overview page).
3. Note your **API Endpoint** (usually `https://cloud.appwrite.io/v1`).

## Step 2 — Add a Web platform (so the browser is allowed to connect)

1. Project → **Settings → Platforms → Add platform → Web**.
2. Add two hostnames (add separately):
   - `localhost`
   - your Vercel domain, e.g. `ronyx.vercel.app`

## Step 3 — Create a secret API key (for the setup script only)

1. Project → **Overview → Integrations → API Keys → Create**.
2. Give it these scopes:
   `databases.read, databases.write, collections.read, collections.write,
    attributes.read, attributes.write, indexes.read, indexes.write,
    documents.read, documents.write, buckets.read, buckets.write`
3. Copy the key. **This key is secret — it goes only in `setup/.env`, never in the frontend.**

## Step 4 — Build the database automatically

In your terminal:

```bash
cd setup
cp .env.example .env        # then open .env and paste endpoint, project ID, API key
npm install
npm run setup               # creates database, 8 collections, indexes, storage
npm run seed                # adds one sample exam + questions (optional but recommended)
```

You should see ✓ lines for each collection and attribute. Re-running is safe — existing items are skipped.

## Step 5 — Turn the frontend on

Open `js/config.js` and set:

```js
CONFIGURED: true,
ENDPOINT:   'https://cloud.appwrite.io/v1',
PROJECT_ID: 'your_project_id',
```

The collection IDs are already filled in to match the setup script — don't change them.

## Step 6 — Test

```bash
npx serve .
```

- **Sign up** with a real email → you'll get a 6-digit code by email → enter it → you land on the dashboard. That's a real account in Appwrite (check **Auth → Users**).
- **Log in / log out** now hit the real backend.

---

## What got created

| Collection      | Holds                                  |
|-----------------|----------------------------------------|
| `users`         | profiles + role (student, lecturer, admin…) |
| `exams`         | exam definitions                       |
| `questions`     | questions linked to an exam            |
| `attempts`      | a student's in-progress / submitted answers |
| `results`       | scores, grade, rank, analysis          |
| `drafts`        | auto-saved text (offline-first)        |
| `notifications` | per-user alerts                        |
| `notes`         | AI study notes & flashcards            |

Plus a **`uploads`** storage bucket (PDF/DOC/JPG/PNG, 10 MB max).

## Security notes (read this)

- `users`, `attempts`, `results`, `drafts`, `notifications`, `notes` use **document-level security** — each row is owned by the user who created it, so students only see their own data.
- `exams` and `questions` are readable by any logged-in user. Their **write** permission is currently open to all logged-in users **for development convenience**. Before going live, lock writes down to an **admins Team** (Appwrite → Auth → Teams) or to Appwrite **Functions**. We'll do this when we build the admin panel.
- The secret API key is only ever used by the setup script on your machine. It is git-ignored.

## Next

Once this works, the pages can load real data using `js/data.js`
(`RonyxData.listExams()`, `RonyxData.startAttempt()`, etc.). Wiring the pages to
live data is the next step.
