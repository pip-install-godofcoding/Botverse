const OpenAI = require('openai');
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

let aiClient = null;
let currentModel = '';

function initAIClient() {
  if (aiClient) return;
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
  } else {
    console.warn("⚠️ No AI API Key is configured.");
  }
}

// Adaptive max tokens & system prompt suffix based on bot type
function getBotConfig(botType) {
  switch (botType) {
    case 'character':
      return {
        maxTokens: 200,
        suffix: `\n\nSTRICT RULES:
- Reply ONLY as this character. NEVER break character. NEVER say you're an AI.
- Match their EXACT speaking style: slang, catchphrases, tone, energy, humor.
- Keep it SHORT — 1 to 3 sentences MAX, like a real WhatsApp/text message.
- NO paragraphs. Talk like you're texting a close friend.
- Use their personality quirks, emojis if they'd use them, in every single reply.`,
      };
    case 'study':
      return {
        maxTokens: 1200,
        suffix: `\n\nRULES:
- You are a Study Buddy. Be encouraging, clear, and pedagogical.
- Break down concepts step by step.
- Use analogies and examples to make things memorable.
- Ask follow-up questions to check understanding.
- Keep responses focused and scannable — use bullet points or numbered lists when helpful.
- If the user seems confused, try a different explanation angle.`,
      };
    case 'presentation':
      return {
        maxTokens: 2000,
        suffix: `\n\nRULES — CRITICAL:
- You are a Presentation Builder Bot.
- When a user gives you a topic to build into a presentation, you MUST respond with ONLY a valid JSON structure. No other text. No markdown. Just the raw JSON object.
- The JSON structure MUST follow this EXACT format:
\`\`\`json
{
  "title": "Presentation Title",
  "slides": [
    { "title": "Slide Title", "content": ["Bullet point 1", "Bullet point 2", "Bullet point 3"] },
    { "title": "Slide 2 Title", "content": ["Point A", "Point B"] }
  ]
}
\`\`\`
- Include 6-8 slides: an intro, main content slides, and a conclusion.
- Keep bullet points concise (max 10 words each).
- If the user is NOT asking to build a presentation (just asking a question), answer normally in plain text without JSON.`,
      };
    case 'mom':
      return {
        maxTokens: 1200,
        suffix: `\n\nRULES:
- You are a Meeting Minutes (MoM) Writer Bot.
- Take the user's raw notes or bullet points and transform them into formal, professional meeting minutes.
- Structure: Date/Time, Attendees, Agenda, Discussion Points, Decisions Made, Action Items (with owner & deadline).
- Be concise but complete.
- Use professional language.`,
      };
    case 'utility':
    default:
      return {
        maxTokens: 1000,
        suffix: `\n\nRULES:
- Be helpful, clear and direct.
- Format responses for readability (bullets, numbered lists when appropriate).
- If you don't know something, say so honestly.
- Keep responses focused on the user's actual question.`,
      };
  }
}

router.post('/', async (req, res) => {
  try {
    initAIClient();
    if (!aiClient) {
      return res.status(500).json({ error: 'AI API Key is missing from .env' });
    }

    const { botPrompt, botType, botName, history, message, documentContext } = req.body;

    if (!message || !botPrompt) {
      return res.status(400).json({ error: 'message and botPrompt are required' });
    }

    const { maxTokens, suffix } = getBotConfig(botType || 'character');
    let systemPrompt = botPrompt + suffix;
    
    // Inject Document Context if provided
    if (documentContext && documentContext.trim()) {
      systemPrompt += `\n\n[USER PROVIDED DOCUMENT CONTEXT START]\n${documentContext.substring(0, 15000)}\n[USER PROVIDED DOCUMENT CONTEXT END]\nAnswer questions based on the document if applicable.`;
    }

    // Build conversation history (last 20 messages for context)
    const trimmedHistory = (history || []).slice(-20).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    // Add system, past history, and current message
    const messages = [
      { role: 'system', content: systemPrompt },
      ...trimmedHistory,
      { role: 'user', content: message },
    ];

    const response = await aiClient.chat.completions.create({
      model: currentModel,
      messages: messages,
      max_tokens: maxTokens,
    });

    const reply = response.choices?.[0]?.message?.content || '...';
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'AI service error', detail: err.message });
  }
});

// POST /api/chat/upload-document
router.post('/upload-document', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    let extractedText = '';
    
    if (req.file.mimetype === 'application/pdf') {
      const parsed = await pdfParse(req.file.buffer);
      extractedText = parsed.text;
    } else if (req.file.mimetype.startsWith('text/')) {
      extractedText = req.file.buffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Please upload PDF or TXT.' });
    }

    res.json({ text: extractedText.trim() });
  } catch (err) {
    console.error('Document parsing error:', err.message);
    res.status(500).json({ error: 'Failed to read document' });
  }
});

module.exports = router;
