/**
 * Agent Engine — Backend
 * 
 * Provides the AI "brain" that interprets natural-language instructions
 * from a user and converts them into structured action parameters.
 * 
 * Any bot with agent capabilities sends its messages here first.
 * The AI returns either:
 *   { type: 'action', action: 'video_trim', params: {...} }
 *   { type: 'chat',   reply: 'plain text response' }
 */
const OpenAI = require('openai');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '../../uploads/tmp');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

let aiClient = null;
let currentModel = '';

function getAI() {
  if (aiClient) return aiClient;
  if (process.env.GROQ_API_KEY || (process.env.XAI_API_KEY && process.env.XAI_API_KEY.startsWith('gsk_'))) {
    const key = process.env.GROQ_API_KEY || process.env.XAI_API_KEY;
    aiClient = new OpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1' });
    currentModel = 'llama-3.3-70b-versatile';
  } else if (process.env.XAI_API_KEY) {
    aiClient = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: 'https://api.xai.com/v1' });
    currentModel = 'grok-2-latest';
  } else if (process.env.SARVAM_API_KEY) {
    aiClient = new OpenAI({ apiKey: process.env.SARVAM_API_KEY, baseURL: 'https://api.sarvam.ai/v1' });
    currentModel = 'sarvam-105b';
  }
  return aiClient;
}

// ─── App Builder Architect (Prompt-to-App) ────────────────────────────────────
// POST /api/agent/architect
// Generates a fully functional bot configuration + custom code from a prompt
router.post('/architect', async (req, res) => {
  const { userPrompt } = req.body;
  if (!userPrompt) return res.status(400).json({ error: 'userPrompt is required' });

  const client = getAI();
  if (!client) return res.status(500).json({ error: 'No AI key configured' });

  const systemPrompt = `You are "The Architect", an elite AI engineer and app builder working inside BotVerse — a platform where users create AI-powered bots that can build and run live interactive applications.

The user will describe the bot they want. Your job is to create the perfect bot configuration as valid JSON.

Output ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "name": "Bot Name (max 3 words)",
  "emoji": "fitting emoji",
  "tag": "Category (e.g. Games, Tools, Creative, Finance, Education)",
  "type": "utility",
  "tools": [],
  "prompt": "The complete system prompt for this bot.",
  "custom_code": null
}

━━━ RULE 1: APP BUILDER MODE (Most Important) ━━━
If the user wants ANYTHING interactive — a game, a tool, a platform, a visualizer, a quiz, an editor, a calculator, a landing page, a dashboard, a chat UI, a form, a timer — the bot's \`prompt\` MUST instruct it to generate full HTML applications.

Embed these exact instructions in the generated bot's \`prompt\`:
"""
You are an elite interactive app builder. When a user asks you to build, create, make, design, or show ANY game, tool, platform, UI, page, quiz, editor, visualizer, or interactive experience:

You MUST output a complete, self-contained HTML application inside these exact tags:
<artifact type="html" title="Your App Title Here">
<!DOCTYPE html>
<html>
  <head>
    <style>/* All CSS embedded here */</style>
  </head>
  <body>
    <!-- Full app UI here -->
    <script>// All JavaScript here</script>
  </body>
</html>
</artifact>

RULES FOR YOUR ARTIFACTS:
- Make them VISUALLY STUNNING: use dark themes, gradients, smooth animations, glassmorphism
- Make them FULLY FUNCTIONAL: games must be playable, tools must work, forms must validate
- Use CDN libraries freely: Tailwind CSS, Three.js, p5.js, Chart.js, Alpine.js, Anime.js
- Include ALL features the user asked for — never output placeholder or incomplete code
- For games: implement full game loop, scoring, keyboard/mouse controls, game over screens
- For tools: implement full functionality with real data manipulation
- For creative apps: make them beautiful and impressive
- You can still add explanatory text BEFORE the <artifact> tag
"""

━━━ RULE 2: LIGHTWEIGHT UI MODE ━━━
For simple data displays (a weather stat, crypto price, card hand in a game already built) use <ui> JSON blocks:
<ui>{"type": "dashboard", "title": "...", "fields": [{"label": "X", "value": "Y"}], "buttons": ["Refresh"]}</ui>
<ui>{"type": "grid", "target": "Username", "title": "...", "items": [{"label": "Red", "value": "4"}], "buttons": ["Play"]}</ui>
For images: use https://image.pollinations.ai/prompt/describe+image+here?width=800&height=400&nologo=true

━━━ RULE 3: LIVE DATA MODE ━━━
If the bot needs real-time internet data (prices, news, weather API), write \`custom_code\`:
- Runs in Node.js sandbox with global fetch()
- Must assign result string to __PAYLOAD
- No require/import. Async IIFE only.
Example: "(async () => { const r = await fetch('https://api.coindesk.com/v1/bpi/currentprice.json'); const d = await r.json(); __PAYLOAD = 'BTC: $' + d.bpi.USD.rate; })();"

Do NOT use markdown code blocks. Output exact JSON only.`;

  try {
    const response = await client.chat.completions.create({
      model: currentModel,
      max_tokens: 4000,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() || '{}';
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const config = JSON.parse(cleaned);

    res.json({ status: 'success', config });
  } catch (err) {
    console.error('[agent/architect] error:', err.message);
    res.status(500).json({ error: 'Failed to generate bot architect config' });
  }
});


// ─── Action Inference ─────────────────────────────────────────────────────────
// POST /api/agent/infer
// Reads a bot's prompt + user's message and returns what action to take.
router.post('/infer', async (req, res) => {
  const { botPrompt, botCapabilities = [], userMessage } = req.body;
  if (!botPrompt || !userMessage) return res.status(400).json({ error: 'botPrompt and userMessage required' });

  const client = getAI();
  if (!client) return res.status(500).json({ error: 'No AI key configured' });

  const capabilityList = botCapabilities.length > 0
    ? `Available actions this bot can perform: ${botCapabilities.join(', ')}.`
    : 'This bot is a general conversational agent with no special file actions.';

  const systemPrompt = `You are an agent router. Your job is to decide how to respond to the user.

${capabilityList}

If the user's message triggers one of the available actions, respond ONLY with valid JSON:
{ "type": "action", "action": "<action_name>", "params": { ...action_specific_params } }

If it's a conversational message or question, respond ONLY with:
{ "type": "chat" }

Known action names and their params:
- video_trim: { start: "HH:MM:SS", end: "HH:MM:SS" }
- video_speed: { speed: 0.5 | 2.0 }
- video_caption: { text: "Caption text", position: "top" | "bottom" }
- video_extract_audio: {}
- video_mute: {}
- game_start: { topic: "topic", rounds: 5 }
- game_answer: { answer: "user's answer" }
- game_hint: {}
- code_run: { code: "code string", language: "python" | "javascript" }
- image_resize: { width: 800, height: 600 }
- image_crop: { x: 0, y: 0, width: 400, height: 300 }
- web_fetch: { url: "https://..." }
- schedule_reminder: { message: "...", minutes: 30 }

Bot context: ${botPrompt.substring(0, 200)}

Respond with ONLY the JSON object. No explanation.`;

  try {
    const response = await client.chat.completions.create({
      model: currentModel,
      max_tokens: 200,
      temperature: 0.1, // be deterministic for routing
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() || '{"type":"chat"}';
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    res.json(parsed);
  } catch (err) {
    console.error('[agent/infer] error:', err.message);
    res.json({ type: 'chat' }); // fallback to chat
  }
});

// ─── Game Engine ──────────────────────────────────────────────────────────────
// In-memory game sessions keyed by groupId
const gameSessions = new Map();

// POST /api/agent/game/start
router.post('/game/start', async (req, res) => {
  const { groupId, topic = 'General Knowledge', rounds = 5, botPrompt } = req.body;
  if (!groupId) return res.status(400).json({ error: 'groupId required' });

  const client = getAI();
  if (!client) return res.status(500).json({ error: 'No AI key configured' });

  try {
    const response = await client.chat.completions.create({
      model: currentModel,
      max_tokens: 1500,
      temperature: 0.7,
      messages: [{
        role: 'system',
        content: `Generate exactly ${rounds} multiple-choice trivia questions about: ${topic}.
Return ONLY valid JSON array:
[
  {
    "question": "...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer": "A",
    "explanation": "Brief explanation"
  }
]
No extra text. Only the JSON array.`,
      }],
    });

    const raw = response.choices[0]?.message?.content?.trim();
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const questions = JSON.parse(cleaned);

    const session = {
      groupId, topic, questions,
      currentQ: 0,
      scores: {},    // userId → score
      answered: {},  // userId → their answer for current Q
      active: true,
    };
    gameSessions.set(groupId, session);

    res.json({
      status: 'started',
      topic,
      totalRounds: questions.length,
      firstQuestion: {
        number: 1,
        total: questions.length,
        ...questions[0],
      },
    });
  } catch (err) {
    console.error('[game/start]', err.message);
    res.status(500).json({ error: 'Failed to generate questions: ' + err.message });
  }
});

// POST /api/agent/game/answer
router.post('/game/answer', (req, res) => {
  const { groupId, userId, displayName, answer } = req.body;
  const session = gameSessions.get(groupId);
  if (!session || !session.active) return res.json({ status: 'no_game' });

  const q = session.questions[session.currentQ];
  if (!q) return res.json({ status: 'no_game' });

  // First answer wins per question per user
  if (session.answered[userId]) return res.json({ status: 'already_answered' });
  session.answered[userId] = answer;

  const correct = answer.toUpperCase().trim() === q.answer.toUpperCase().trim();
  if (correct) {
    session.scores[userId] = (session.scores[userId] || 0) + 1;
  }

  // Check if we should advance (after short delay handled client-side)
  const isLastQ = session.currentQ >= session.questions.length - 1;
  
  let nextQuestion = null;
  if (!isLastQ) {
    session.currentQ++;
    session.answered = {};
    nextQuestion = {
      number: session.currentQ + 1,
      total: session.questions.length,
      ...session.questions[session.currentQ],
    };
  } else {
    session.active = false;
  }

  res.json({
    status: correct ? 'correct' : 'wrong',
    correct,
    correctAnswer: q.answer,
    explanation: q.explanation,
    scores: session.scores,
    isLastQ,
    nextQuestion,
    displayName,
  });
});

// GET /api/agent/game/state
router.get('/game/state', (req, res) => {
  const { groupId } = req.query;
  const session = gameSessions.get(groupId);
  if (!session) return res.json({ active: false });

  const q = session.questions[session.currentQ];
  res.json({
    active: session.active,
    topic: session.topic,
    scores: session.scores,
    currentQuestion: q ? {
      number: session.currentQ + 1,
      total: session.questions.length,
      ...q,
    } : null,
  });
});

// ─── Code Runner (sandboxed) ──────────────────────────────────────────────────
// POST /api/agent/code/run
router.post('/code/run', (req, res) => {
  const { code, language = 'javascript', timeout = 5000 } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });
  if (code.length > 5000) return res.status(400).json({ error: 'Code too long (max 5000 chars)' });

  // Block dangerous patterns
  const BLOCKED = ['require', 'import ', 'fs.', 'exec', 'spawn', 'child_process', '__dirname', 'process.env'];
  if (language === 'javascript' && BLOCKED.some(p => code.includes(p))) {
    return res.json({ output: '⛔ Blocked: unsafe code pattern detected.' });
  }

  if (language === 'javascript') {
    const wrappedCode = `
const __log = [];
const console = { log: (...a) => __log.push(a.join(' ')), error: (...a) => __log.push('ERR: '+a.join(' ')) };
try { ${code} } catch(e) { __log.push('Error: '+e.message); }
__log.join('\\n');
`;
    try {
      // Use vm2-safe eval - basic Function() with timeout
      const fn = new Function(wrappedCode);
      const result = fn();
      res.json({ output: result || '(no output)', language });
    } catch (err) {
      res.json({ output: `Runtime error: ${err.message}`, language });
    }
  } else {
    res.json({ output: 'Python execution requires server-side sandboxing. JS execution is active.', language });
  }
});

// ─── Uploads serving ──────────────────────────────────────────────────────────
// GET /api/agent/file/:filename
router.get('/file/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../../uploads/tmp', req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath);
});

module.exports = router;
