/* ============================================================
   RONYX · api/student-ai.js — Student Conversational AI
   Powers the floating Ronyx AI chat widget on student pages.

   Security: verifies Appwrite session if present; falls back
   to strict IP rate-limit only (no session key stored yet).
   Gemini responses are short for TTS readability.
   ============================================================ */
'use strict';

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const APPWRITE_PROJECT  = process.env.APPWRITE_PROJECT  || '6a332fd80025b72ea503';

const _rate = {};
function checkRate(ip, limit) {
  const now = Date.now(), win = 5 * 60 * 1000;
  if (!_rate[ip]) _rate[ip] = [];
  _rate[ip] = _rate[ip].filter(t => now - t < win);
  if (_rate[ip].length >= limit) return false;
  _rate[ip].push(now);
  return true;
}

/* Call Gemini via REST — works with AQ. and AIzaSy key formats */
async function callAI(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set in Vercel environment variables');
  const url  = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + key;
  const resp = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    const detail = data?.error?.message || data?.error?.status || JSON.stringify(data).slice(0, 200);
    throw new Error('Gemini ' + resp.status + ': ' + detail);
  }
  return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

async function verifySession(key) {
  const sdk    = require('node-appwrite');
  const client = new sdk.Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT)
    .setSession(key);
  return await new sdk.Account(client).get();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  /* AI temporarily disabled */
  return res.status(503).json({ error: 'AI features are temporarily unavailable. Please check back soon.' });

  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'AI not configured — add GEMINI_API_KEY to Vercel settings.' });

  const ip  = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const key = req.headers['x-session'] || '';

  /* Try session verification — but NEVER block students for an expired key.
     A bad/missing key just drops to a tighter rate limit. Students log in
     only occasionally; forcing re-login here breaks the chat UX. */
  let verified = false;
  if (key) {
    try { await verifySession(key); verified = true; }
    catch(e) { /* session expired or wrong key — proceed with strict rate limit */ }
  }

  const limit = verified ? 30 : 8;
  if (!checkRate(ip, limit)) {
    return res.status(429).json({ error: 'Too many requests. Try again in a few minutes.' });
  }

  const { message, bookTitle, bookContext, history } = req.body || {};
  if (!message || typeof message !== 'string' || message.length > 500) {
    return res.status(400).json({ error: 'Invalid message' });
  }

  const histText = (Array.isArray(history) ? history.slice(-6) : [])
    .map(h => (h.role === 'user' ? 'Student' : 'Ronyx') + ': ' + h.content)
    .join('\n');

  const bookCtx = bookTitle
    ? `The student is currently reading: "${bookTitle}"` +
      (bookContext ? `\n\nExcerpt from the book:\n${bookContext.slice(0, 500)}` : '')
    : 'The student is browsing the library.';

  const prompt = `You are Ronyx AI — a warm, smart university study assistant built into the Ronyx learning app (Nigeria). You help students understand course materials, answer questions, explain concepts simply, and quiz them.

${bookCtx}

${histText ? 'Recent conversation:\n' + histText + '\n\n' : ''}Student: ${message}

Reply as Ronyx AI. CRITICAL RULES — your reply will be spoken aloud by text-to-speech:
1. Maximum 3 sentences unless the student explicitly asks for a detailed explanation
2. Plain natural speech only — NO markdown, NO asterisks, NO bullet points, NO numbering
3. If quizzing the student, ask exactly ONE question at a time
4. Be warm, encouraging, and specific to the book/topic if context is given
5. End with a follow-up question to keep the conversation going`;

  try {
    const reply = await callAI(prompt);
    return res.status(200).json({ reply: reply || "I didn't quite catch that. Could you ask again?" });
  } catch(e) {
    console.error('[student-ai]', e.message);
    const msg = e.message || '';
    if (msg.includes('quota') || msg.includes('429')) {
      return res.status(500).json({ error: 'Free AI quota reached. Try again in a minute.' });
    }
    return res.status(500).json({ error: 'AI error: ' + msg.slice(0, 120) });
  }
};
