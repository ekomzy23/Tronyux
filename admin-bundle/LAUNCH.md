# RONYX Admin — Launch in Minutes

The admin console for RONYX. Manage exams, questions, books, and the equation
library. Everything you publish reflects in the student app **live** (real-time).

## 1. Build the backend (one time)

This creates the shared Appwrite database that BOTH the admin and student apps use.

```bash
cd setup
cp .env.example .env       # paste your Appwrite endpoint, project ID, API key
npm install
npm run backend            # builds collections, storage, seeds sample data + equations
```

Get those values from https://cloud.appwrite.io → your project → Settings + API Keys.
Also add a **Web platform** there for your admin domain (e.g. admin.ronyx.com) and localhost.

## 2. Connect this app

Edit `js/config.js`:

```js
CONFIGURED: true,
ENDPOINT:   'https://cloud.appwrite.io/v1',
PROJECT_ID: 'your_project_id',
```

(Use the SAME values in the student app's config so they share data.)

## 3. Run it

```bash
cd ..
npx serve .
```

Open `http://localhost:5000/pages/login.html` and sign in.

## 4. Deploy

```bash
vercel && vercel --prod
```

## What you can manage

- **Exams** — create/edit/publish, tag each with a Year (1–5)
- **Questions** — MCQ, true/false, theory, fill, upload; linked to exams
- **Library** — books with summaries + key takeaways
- **Equations** — math/physics/chemistry library (18 built-in, add unlimited) with live LaTeX preview
- **Students** — all accounts and their year
- **Results** — submissions overview

## Real-time

Lists in this console refresh automatically when data changes, and the student
app picks up your changes live. No refresh needed.

## Security (optional, recommended before public launch)

In `js/config.js` set `REQUIRE_ADMIN_TEAM: true`. Then in the Appwrite console
create a Team called **admins** and add your account to it. Only team members
will be able to use this console.
