import React, { useState, useEffect } from 'react';
import { createBot } from '../../lib/api';

const EMOJIS = ['🤖', '🦸', '🧙', '🎭', '🌟', '🔥', '💫', '🥷', '👑', '🦊', '🐉', '🧠',
                 '👨‍💻', '🎓', '📚', '🎯', '⚡', '🌈', '🦁', '🐺', '🦅', '💎', '🚀', '🎪'];

const COLORS = ['#6C63FF', '#FF6B35', '#00C9A7', '#FF4081', '#FFB300', '#00BCD4', '#9C27B0', '#F44336', '#1DB954', '#5ac8fa', '#ec4899', '#f59e0b'];

const TAGS = ['Anime', 'Bollywood', 'Hollywood', 'Science', 'History', 'Comedy', 'Sports', 'Music', 'Tech', 'Art', 'Utility', 'Custom'];

const BOT_TYPES = [
  { id: 'character', label: 'Character Bot', emoji: '🎭', desc: 'Roleplay as a person, fictional character, celebrity, etc.' },
  { id: 'utility',   label: 'Custom Tool',   emoji: '🛠️', desc: 'Describe what you need — the platform builds the right tool.' },
  { id: 'study',     label: 'Study Buddy',   emoji: '📚', desc: 'Explains topics, analyses papers, quizzes you, teaches anything.' },
  { id: 'presentation', label: 'PPT Builder', emoji: '📊', desc: 'Generates a real, downloadable PowerPoint from any topic.' },
  { id: 'mom',       label: 'MoM Writer',    emoji: '📝', desc: 'Converts raw meeting notes into formal minutes of meetings.' },
];

const PROMPT_TEMPLATES = {
  character: `You are [Name], [brief description]. You speak in [style]. You always [key trait]. Your favourite phrases are: "..."`,
  utility:   `You are a [describe what this tool does, e.g. "legal document summariser" / "code reviewer" / "recipe generator"]. When the user [describes their need], you [explain how you respond]. Format your output as [list / table / step-by-step / etc].`,
  study:     `You are a Study Buddy specialized in [subject]. You use clear explanations, real analogies, quizzes, and you can analyse documents the user uploads (past papers, notes, textbooks).`,
  presentation: `You are a Presentation Builder. When given a topic or notes, you generate a structured slide deck in JSON format so the user can immediately download a real PowerPoint file.`,
  mom:       `You are a professional MoM Writer. Transform raw meeting notes into formal minutes with sections: Attendees, Agenda, Discussion, Decisions, Action Items, Next Steps.`,
};

const TOOL_DEFS = {
  smartboard:   { emoji: '🎨', label: 'Smart Board',          color: '#00C9A7' },
  docs:         { emoji: '📎', label: 'Document Analysis',   color: '#5ac8fa' },
  ppt:          { emoji: '📊', label: 'PPT Generator',        color: '#FF6B35' },
  game:         { emoji: '🎮', label: 'Game Engine',          color: '#FFB300' },
  video_editor: { emoji: '🎥', label: 'Video Editor',         color: '#FF4081' },
  code_runner:  { emoji: '💻', label: 'Code Runner',          color: '#9C27B0' },
};

// ─── Intelligent Tool Inference ────────────────────────────────────────────────
// Reads the user's bot name + prompt description and infers which workspace
// tools to activate — no manual selection needed.
function inferTools(name, prompt, type) {
  const text = `${name} ${prompt}`.toLowerCase();
  const toolSet = new Set();

  // Type-based defaults
  if (type === 'presentation') { toolSet.add('ppt'); toolSet.add('docs'); }
  if (type === 'study')        { toolSet.add('smartboard'); toolSet.add('docs'); }

  // Keyword-driven inference
  const PPT_KW   = ['ppt', 'powerpoint', 'presentation', 'slide', 'deck', 'keynote'];
  const BOARD_KW = ['draw', 'diagram', 'sketch', 'whiteboard', 'board', 'visual', 'canvas', 'flowchart', 'mind map', 'collaborate', 'together'];
  const DOC_KW   = ['pdf', 'document', 'paper', 'notes', 'file', 'analyse', 'analyze', 'summarise', 'summarize', 'upload', 'read', 'extract', 'past papers', 'textbook', 'report', 'research'];
  const GAME_KW  = ['game', 'quiz', 'trivia', 'host', 'play', 'question', 'score', 'riddle', 'challenge', 'round', 'guess', 'hangman', 'wordle', 'board game'];
  const VIDEO_KW = ['video', 'edit video', 'trim', 'clip', 'reel', 'footage', 'mp4', 'movie', 'film', 'cut', 'ffmpeg', 'subtitle'];
  const CODE_KW  = ['code', 'run code', 'execute', 'javascript', 'python', 'script', 'programming', 'compiler', 'sandbox', 'terminal'];

  if (PPT_KW.some(w   => text.includes(w))) toolSet.add('ppt');
  if (BOARD_KW.some(w => text.includes(w))) toolSet.add('smartboard');
  if (DOC_KW.some(w   => text.includes(w))) toolSet.add('docs');
  if (GAME_KW.some(w  => text.includes(w))) toolSet.add('game');
  if (VIDEO_KW.some(w => text.includes(w))) toolSet.add('video_editor');
  if (CODE_KW.some(w  => text.includes(w))) toolSet.add('code_runner');

  return [...toolSet];
}
// ───────────────────────────────────────────────────────────────────────────────

export default function CreateBotModal({ onClose, onCreated, userId, displayName }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🤖');
  const [color, setColor] = useState('#6C63FF');
  const [tag, setTag] = useState('Custom');
  const [type, setType] = useState('character');
  const [prompt, setPrompt] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Tools are inferred automatically — no manual selection
  const inferredTools = inferTools(name, prompt, type);
  const isUtilityBot = type !== 'character';
  const selectedType = BOT_TYPES.find(t => t.id === type);

  const handleTypeSelect = (t) => {
    setType(t);
    if (!prompt) setPrompt(PROMPT_TEMPLATES[t] || '');
  };

  const handleCreate = async () => {
    if (!name || !prompt) return;
    setSaving(true);
    setError('');
    const botData = {
      name, emoji, color, prompt, type, tag,
      is_public: isPublic,
      tools: inferredTools,  // auto-inferred from the prompt
    };
    try {
      let bot;
      if (userId) {
        const res = await createBot({ ...botData, creator_id: userId, creator_name: displayName || 'Me' });
        bot = res.bot;
      } else {
        bot = { id: `local-${Date.now()}`, ...botData, creator_name: displayName || 'Me' };
      }
      onCreated({ ...bot, lastMsg: 'Just created! Say hi 👋', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), unread: 0 });
    } catch (err) {
      setError('Saved locally (Supabase not reached).');
      onCreated({ id: `local-${Date.now()}`, ...botData, creator_name: displayName || 'Me', lastMsg: 'Just created! Say hi 👋', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), unread: 0 });
    }
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg-overlay)' }} />
        </div>

        <div style={{ padding: '8px 20px 0' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>
              {step === 1 ? '✨ New Bot / Tool' : step === 2 ? '🛠️ Tool Type' : '💬 Describe It'}
            </div>
            <button onClick={onClose} style={{ background: 'var(--bg-overlay)', border: 'none', color: 'var(--text-secondary)', borderRadius: '50%', width: 32, height: 32, fontSize: 15, cursor: 'pointer' }}>✕</button>
          </div>

          {/* Progress — always 3 steps */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{ height: 3, flex: 1, borderRadius: 3, background: s <= step ? color : 'var(--bg-overlay)', transition: 'background 0.3s' }} />
            ))}
          </div>
        </div>

        <div style={{ padding: '0 20px 32px', overflowY: 'auto', maxHeight: '70vh' }}>

          {/* ── Step 1: Name, Emoji, Color ── */}
          {step === 1 && (
            <>
              {/* Preview avatar */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${color}cc, ${color}44)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 40, boxShadow: `0 4px 20px ${color}44`,
                }}>
                  {emoji}
                </div>
              </div>

              <input
                id="bot-name-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Name it (e.g. Study Guru, Pitch Deck Pro, Legal Eagle)"
                style={{
                  width: '100%', background: 'var(--bg-base)', border: 'none',
                  borderBottom: `2px solid ${name ? color : 'var(--border)'}`,
                  padding: '10px 2px', color: 'var(--text-primary)', fontSize: 16,
                  outline: 'none', marginBottom: 22, transition: 'border-color 0.2s',
                }}
              />

              <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, marginBottom: 10 }}>EMOJI</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setEmoji(e)}
                    style={{ width: 40, height: 40, borderRadius: 10, fontSize: 20, background: emoji === e ? `${color}33` : 'var(--bg-base)', border: `1.5px solid ${emoji === e ? color : 'var(--border)'}`, transition: 'all 0.15s', cursor: 'pointer' }}>
                    {e}
                  </button>
                ))}
              </div>

              <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, marginBottom: 10 }}>COLOR</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    style={{ width: 30, height: 30, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', outline: color === c ? `3px solid ${c}` : '3px solid transparent', outlineOffset: 2, transition: 'outline 0.15s' }}
                  />
                ))}
              </div>

              <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, marginBottom: 10 }}>CATEGORY TAG</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 26 }}>
                {TAGS.map(t => (
                  <button key={t} onClick={() => setTag(t)}
                    style={{ padding: '5px 13px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: tag === t ? `${color}25` : 'var(--bg-base)', border: `1px solid ${tag === t ? color : 'var(--border)'}`, color: tag === t ? color : 'var(--text-muted)' }}>
                    {t}
                  </button>
                ))}
              </div>

              <button id="create-bot-step1-next" onClick={() => name && setStep(2)}
                style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: name ? color : 'var(--bg-overlay)', color: name ? '#fff' : 'var(--text-muted)', fontWeight: 700, fontSize: 15, cursor: name ? 'pointer' : 'default', transition: 'background 0.2s' }}>
                Continue →
              </button>
            </>
          )}

          {/* ── Step 2: Bot Type ── */}
          {step === 2 && (
            <>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 18, lineHeight: 1.5 }}>
                What kind of tool is <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>?
                <br /><span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>The platform will auto-configure the right workspace from your description in the next step.</span>
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {BOT_TYPES.map(t => (
                  <button key={t.id} onClick={() => handleTypeSelect(t.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${type === t.id ? color : 'var(--border)'}`, background: type === t.id ? `${color}15` : 'var(--bg-base)', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <span style={{ fontSize: 28 }}>{t.emoji}</span>
                    <div>
                      <div style={{ color: type === t.id ? color : 'var(--text-primary)', fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{t.label}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.4 }}>{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, padding: 13, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>← Back</button>
                <button id="create-bot-step2-next" onClick={() => setStep(3)} style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: color, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Continue →</button>
              </div>
            </>
          )}

          {/* ── Step 3: Describe the tool (Prompt) ── */}
          {step === 3 && (
            <>
              {/* Preview */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${color}cc, ${color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
                  {emoji}
                </div>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>{name}</div>
                  <div style={{ color, fontSize: 12, fontWeight: 600 }}>{selectedType?.emoji} {selectedType?.label} · #{tag}</div>
                </div>
              </div>

              <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, marginBottom: 8 }}>
                DESCRIBE WHAT THIS TOOL DOES
              </div>
              <textarea
                id="bot-prompt-input"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={PROMPT_TEMPLATES[type]}
                rows={7}
                style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, color: 'var(--text-primary)', fontSize: 13.5, outline: 'none', resize: 'none', lineHeight: 1.6, marginBottom: 10, transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = color}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />

              {/* Auto-detected tools preview — shown live as user types */}
              {isUtilityBot && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, marginBottom: 8 }}>
                    ⚡ AUTO-DETECTED WORKSPACE TOOLS
                  </div>
                  {inferredTools.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 12.5, fontStyle: 'italic', padding: '8px 0' }}>
                      Keep describing your tool — mention keywords like "draw", "pdf", "presentation" to auto-activate tools…
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {inferredTools.map(toolId => {
                        const def = TOOL_DEFS[toolId];
                        return (
                          <div key={toolId} style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${def.color}22`, border: `1px solid ${def.color}66`, borderRadius: 20, padding: '5px 12px', animation: 'fadeIn 0.2s ease' }}>
                            <span style={{ fontSize: 15 }}>{def.emoji}</span>
                            <span style={{ color: def.color, fontWeight: 700, fontSize: 12.5 }}>{def.label}</span>
                            <span style={{ color: def.color, fontSize: 11 }}>✓</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Hints */}
              <div style={{ background: 'var(--bg-base)', borderLeft: `3px solid ${color}`, padding: '10px 12px', borderRadius: '0 8px 8px 0', marginBottom: 16, color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.6 }}>
                {type === 'character'     && '💡 Include their speech style, catchphrases, personality quirks, and how they react emotionally.'}
                {type === 'utility'       && '💡 Be specific about the domain and output format. E.g. "You summarise legal clauses into plain English bullet points."'}
                {type === 'study'         && '💡 Mention the subject area. Say "You can analyse uploaded PDFs and past papers" to unlock Document Analysis.'}
                {type === 'presentation'  && '💡 The PPT Builder is already active. Just send a topic like "Climate Change" and a real .pptx will be generated.'}
                {type === 'mom'           && '💡 You can say "analyse meeting audio transcripts users upload" to also enable document upload mode.'}
              </div>

              {/* Public toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: '12px 14px', background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>Share in Marketplace</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Let others discover and use this tool</div>
                </div>
                <button onClick={() => setIsPublic(v => !v)}
                  style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: isPublic ? color : 'var(--bg-overlay)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 2, left: isPublic ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                </button>
              </div>

              {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(2)} style={{ flex: 1, padding: 13, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>← Back</button>
                <button id="create-bot-submit" onClick={handleCreate} disabled={!prompt || saving}
                  style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: prompt && !saving ? color : 'var(--bg-overlay)', color: prompt && !saving ? '#fff' : 'var(--text-muted)', fontWeight: 700, fontSize: 15, cursor: prompt && !saving ? 'pointer' : 'default' }}>
                  {saving ? '⏳ Building...' : `🚀 Create ${selectedType?.label}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
