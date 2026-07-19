/* ============================================================
   RONYX · api/ai.js — Vercel Serverless Function
   Secure AI content generation via Claude (Anthropic).

   Security model:
   1. Admin must pass their Appwrite session key (from localStorage
      cookieFallback) as the X-Admin-Session header.
   2. The function verifies the session against Appwrite server-side
      before calling Claude — the API key never touches the browser.
   3. Per-IP rate limiting (10 requests / 5 min).

   Environment variables (set in Vercel dashboard):
     GEMINI_API_KEY     — free from aistudio.google.com → "Get API key"
     ADMIN_EMAIL        — e.g. you@example.com  (optional extra check)
     APPWRITE_ENDPOINT  — defaults to https://nyc.cloud.appwrite.io/v1
     APPWRITE_PROJECT   — your Appwrite project ID
   ============================================================ */
'use strict';

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const APPWRITE_PROJECT  = process.env.APPWRITE_PROJECT  || '6a332fd80025b72ea503';
const ADMIN_EMAIL       = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();

/* Simple in-memory rate limiter — resets on cold start, sufficient for abuse prevention */
const _rate = {};
function checkRate(ip) {
  const now = Date.now(), window = 5 * 60 * 1000, limit = 10;
  if (!_rate[ip]) _rate[ip] = [];
  _rate[ip] = _rate[ip].filter(t => now - t < window);
  if (_rate[ip].length >= limit) return false;
  _rate[ip].push(now);
  return true;
}

/* Verify Appwrite session server-side using the node-appwrite SDK */
async function verifyAdminSession(sessionKey) {
  const sdk = require('node-appwrite');
  const client = new sdk.Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT)
    .setSession(sessionKey);
  const account = new sdk.Account(client);
  const user = await account.get();           /* throws if session invalid */
  if (ADMIN_EMAIL && user.email.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Not the admin account');
  }
  return user;
}

/* Call Gemini via REST — works with AQ. and AIzaSy key formats */
async function callAI(prompt, pdfBase64) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + key;
  const parts = pdfBase64
    ? [{ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } }, { text: prompt }]
    : [{ text: prompt }];
  const resp = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    const detail = data?.error?.message || data?.error?.status || JSON.stringify(data).slice(0, 200);
    throw new Error('Gemini ' + resp.status + ': ' + detail);
  }
  return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

/* Build the Claude prompt based on requested type */
function buildPrompt(type, payload) {
  if (type === 'book_summary') {
    const { title, author, subject, courseCode, department } = payload;
    return {
      prompt: `You are an academic content writer for a university e-learning platform. Write a comprehensive, student-friendly course summary for the following material:

Title: ${title || 'Unknown'}
Author: ${author || 'Unknown'}
Subject: ${subject || 'Not specified'}
Course Code: ${courseCode || 'Not specified'}
Department: ${department || 'Not specified'}

Write a structured academic summary with:
- A brief introduction (2-3 sentences)
- 4-6 main topic sections using ## headings
- Under each section, 3-4 clear bullet points with key concepts
- A brief conclusion

Markdown format only:
- ## Main headings
- ### Sub-headings
- - Bullet points
- **Bold** for key terms
- > Important definitions

Length: 450-650 words. Be accurate, educational, and student-focused.`,
      maxTokens: 1600
    };
  }

  if (type === 'book_takeaways') {
    const { title, summary } = payload;
    const snippet = (summary || '').slice(0, 1200);
    return {
      prompt: `Based on this educational content about "${title || 'the subject'}", write exactly 5 key takeaways students should remember for exams.

${snippet ? 'Content:\n' + snippet : 'Generate general takeaways based on the title alone.'}

Rules:
- Exactly 5 takeaways, one per line
- Each starts with an action verb or key term
- Max 2 sentences each
- Exam-relevant and memorable
- Plain text only — no bullets, no numbering, no markdown`,
      maxTokens: 350
    };
  }

  if (type === 'exam_questions') {
    const { topic, subject, level, qtype, difficulty, count, courseCode } = payload;
    const n = Math.min(parseInt(count) || 5, 20);
    const diff = difficulty || 'medium';
    const subj = subject || topic;

    if (qtype === 'mcq') {
      return {
        prompt: `Generate ${n} multiple-choice exam questions for a Nigerian university.

Topic: ${topic}
Subject: ${subj}
Course Code: ${courseCode || 'Not specified'}
Year Level: Year ${level || 1}
Difficulty: ${diff}

Rules:
- Each question must be clear and unambiguous
- Exactly 4 options (A, B, C, D) per question
- One clearly correct answer
- Plausible but incorrect distractors
- Include a brief explanation

Return ONLY valid JSON array, no surrounding text:
[{"text":"Question?","options":["A","B","C","D"],"correctAnswer":"A","explanation":"Why A is correct","difficulty":"${diff}","type":"mcq"}]`,
        maxTokens: 2500
      };
    }

    if (qtype === 'theory') {
      return {
        prompt: `Generate ${n} theory/essay exam questions for a Nigerian university.

Topic: ${topic}
Subject: ${subj}
Year Level: Year ${level || 1}
Difficulty: ${diff}

Mix question types: explain, discuss, compare, evaluate, analyse.

Return ONLY valid JSON array:
[{"text":"Question text (10 marks)","correctAnswer":"Model answer key points: 1... 2... 3...","difficulty":"${diff}","type":"theory"}]`,
        maxTokens: 2000
      };
    }

    if (qtype === 'truefalse') {
      return {
        prompt: `Generate ${n} true/false questions for a university exam on: ${topic} (Year ${level || 1}, ${diff}).

Return ONLY valid JSON array:
[{"text":"Statement.","options":["True","False"],"correctAnswer":"True","explanation":"Brief reason","difficulty":"${diff}","type":"truefalse"}]`,
        maxTokens: 1500
      };
    }

    /* fill-in-the-blank default */
    return {
      prompt: `Generate ${n} fill-in-the-blank questions for a university exam on: ${topic} (Year ${level || 1}, ${diff}).
Use _____ for the blank. Test key terms and definitions.

Return ONLY valid JSON array:
[{"text":"The process of _____ converts X to Y.","correctAnswer":"key term","explanation":"Brief explanation","difficulty":"${diff}","type":"fill"}]`,
      maxTokens: 1500
    };
  }

  if (type === 'question_improve') {
    const { questionText, options } = payload;
    return {
      prompt: `Improve this exam question for clarity and educational quality. Return ONLY the improved question text${options ? ' and improved options on separate lines' : ''}, nothing else.

Original: ${questionText}
${options ? 'Options: ' + options.join(' | ') : ''}`,
      maxTokens: 400
    };
  }

  if (type === 'free_prompt') {
    return {
      prompt: `You are an AI assistant for a Nigerian university exam and e-learning platform called Ronyx. Help the admin create educational content, exam questions, course summaries, and study materials. Be concise and practical.

Admin: ${payload.message}`,
      isPdf: false
    };
  }

  if (type === 'pdf_summary') {
    return {
      prompt: `You are an academic content writer for a university e-learning platform. Read this PDF document carefully and write a comprehensive, student-friendly summary of its ACTUAL content — not generic knowledge.

Structure:
- Brief introduction (2-3 sentences about what this specific document covers)
- 4-6 main topic sections using ## headings based on the actual PDF content
- Under each section, 3-4 bullet points with key concepts from the document
- Brief conclusion

Format (markdown only):
## Main heading
- Bullet point
**Bold** key terms
> Important definitions or direct quotes

Length: 500-700 words. Only summarise what is actually in this PDF.`,
      isPdf: true
    };
  }

  if (type === 'pdf_questions') {
    const { qtype, difficulty, count } = payload;
    const n = Math.min(parseInt(count) || 5, 20);
    const diff = difficulty || 'medium';

    if (qtype === 'theory') {
      return {
        prompt: `Read this PDF document and generate ${n} theory/essay exam questions based ONLY on its actual content.
Mix types: explain, discuss, compare, evaluate, analyse — all drawing from this specific document.
Return ONLY valid JSON array:
[{"text":"Question (10 marks)","correctAnswer":"Key points from the PDF: 1. ... 2. ... 3. ...","difficulty":"${diff}","type":"theory"}]`,
        isPdf: true
      };
    }
    if (qtype === 'truefalse') {
      return {
        prompt: `Read this PDF and generate ${n} true/false questions using ONLY facts stated in this document.
Return ONLY valid JSON array:
[{"text":"Statement from PDF.","options":["True","False"],"correctAnswer":"True","explanation":"The document states...","difficulty":"${diff}","type":"truefalse"}]`,
        isPdf: true
      };
    }
    if (qtype === 'fill') {
      return {
        prompt: `Read this PDF and generate ${n} fill-in-the-blank questions using KEY TERMS and definitions from this document. Use _____ for the blank.
Return ONLY valid JSON array:
[{"text":"According to the document, _____ is...","correctAnswer":"exact term from PDF","explanation":"As stated in the document...","difficulty":"${diff}","type":"fill"}]`,
        isPdf: true
      };
    }
    return {
      prompt: `Read this PDF document and generate ${n} multiple-choice questions based ONLY on its actual content.
Rules: questions must test what is in THIS document · 4 options (A,B,C,D) · one correct answer · plausible distractors · brief explanation referencing the PDF.
Return ONLY valid JSON array:
[{"text":"Question?","options":["A","B","C","D"],"correctAnswer":"A","explanation":"The PDF states...","difficulty":"${diff}","type":"mcq"}]`,
      isPdf: true
    };
  }

  throw new Error('Unknown type: ' + type);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Session');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  /* AI temporarily disabled */
  return res.status(503).json({ error: 'AI features are temporarily unavailable. Please check back soon.' });

  /* Rate limit */
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRate(ip)) {
    return res.status(429).json({ error: 'Too many requests. Wait 5 minutes and try again.' });
  }

  /* Require AI API key */
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'AI not configured. Add GEMINI_API_KEY to Vercel settings.' });
  }

  /* Verify admin session */
  const sessionKey = req.headers['x-admin-session'];
  if (!sessionKey) return res.status(401).json({ error: 'Missing X-Admin-Session header' });

  try {
    await verifyAdminSession(sessionKey);
  } catch (e) {
    return res.status(401).json({
      error: 'Session invalid or expired. Log out and back in to refresh your session.'
    });
  }

  /* Parse body */
  const { type, payload } = req.body || {};
  const ALLOWED = ['book_summary','book_takeaways','exam_questions','question_improve','free_prompt','pdf_summary','pdf_questions'];
  if (!type || !ALLOWED.includes(type)) {
    return res.status(400).json({ error: 'Invalid or missing type' });
  }
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Missing payload' });
  }

  /* Guards */
  if (type === 'free_prompt' && (!payload.message || payload.message.length > 2000)) {
    return res.status(400).json({ error: 'Prompt must be 1–2000 characters' });
  }
  if ((type === 'pdf_summary' || type === 'pdf_questions') && !payload.pdfBase64) {
    return res.status(400).json({ error: 'No PDF data provided' });
  }
  if (payload.pdfBase64 && payload.pdfBase64.length > 4_200_000) {
    return res.status(413).json({ error: 'PDF too large — please use a file under 3 MB.' });
  }

  /* Build prompt & call AI */
  try {
    const { prompt, isPdf } = buildPrompt(type, payload);
    const result = await callAI(prompt, isPdf && payload.pdfBase64 ? payload.pdfBase64 : null);
    return res.status(200).json({ result, type });
  } catch (e) {
    console.error('[ai] error:', e.message);
    const msg = (e.message || '').includes('quota')
      ? 'Free Gemini quota reached. Try again in a minute (free tier: 15 requests/min).'
      : 'AI generation failed: ' + (e.message || 'Unknown error');
    return res.status(500).json({ error: msg });
  }
};
