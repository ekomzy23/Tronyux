# RUNYX — AI Examination Platform (Frontend)

Plain HTML / CSS / JS. Multi-page, mobile-first. Static-hosted on Vercel.

## Folder structure

```
runyx/
├── index.html          Entry point (redirects to splash)
├── vercel.json         Static hosting config
├── README.md
├── css/
│   ├── tokens.css      Design system — colors, type, spacing (load FIRST)
│   ├── reset.css       Modern reset
│   ├── base.css        Base elements + app shell + utilities
│   └── components.css  Buttons, cards, inputs, etc. (added next)
├── js/                 Shared scripts
├── pages/
│   ├── auth/           splash, welcome, login, signup, otp, forgot
│   ├── student/        dashboard, exam, results, study, profile…
│   └── admin/          admin panel
└── assets/
    ├── icons/
    └── images/
```

## CSS load order (important)

Always link the CSS in this order in every page:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

<link rel="stylesheet" href="/css/tokens.css">
<link rel="stylesheet" href="/css/reset.css">
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/components.css">
```

## Run locally

No build step. Serve the folder with any static server:

```bash
npx serve .
# or
python3 -m http.server 5500
```

Then open the printed localhost URL.

## Deploy to Vercel

```bash
npm i -g vercel
vercel        # first deploy (link/create project)
vercel --prod # production
```

Or push to GitHub and import the repo in the Vercel dashboard — no settings needed (it's static).

## Theme

Dark by default. Switch to light by adding `data-theme="light"` to the `<html>` tag.
All colors come from `css/tokens.css` — change them in one place.
