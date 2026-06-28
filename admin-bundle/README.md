# RONYX Admin Console

Manage exams, questions, books, equations, students, and results. Shares the same Appwrite backend as the student app — anything you publish here is immediately visible to students.

## Run locally

```bash
npx serve .
```

Open `http://localhost:5000/pages/login.html`

## Deploy to Vercel

```bash
vercel
vercel --prod
```

## Configuration

Edit `js/config.js` with your Appwrite endpoint and project ID (same as the student app). All other settings inherit from the shared backend.
