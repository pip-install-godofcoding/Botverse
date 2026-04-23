import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { createBot } from '../lib/api';
import CharacterChat from '../components/chat/CharacterChat';
import ArtifactViewer from '../components/chat/ui/ArtifactViewer';

const BASE = import.meta.env.VITE_BACKEND_URL || 'https://botverse-production.up.railway.app';

const ALL_TOOLS = [
  { id: 'smartboard',   label: '🎨 Smart Board' },
  { id: 'docs',         label: '📎 Documents'   },
  { id: 'ppt',          label: '📊 PPT Maker'   },
  { id: 'game',         label: '🎮 Game Engine' },
  { id: 'video_editor', label: '🎬 Video Editor'},
];

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0b14;
      color: #fff;
      font-family: 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      flex-direction: column;
      gap: 20px;
      padding: 40px;
    }
    h1 { font-size: 2.5rem; background: linear-gradient(135deg, #6C63FF, #00c9a7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    p { color: #888; text-align: center; max-width: 400px; line-height: 1.6; }
    button {
      padding: 12px 28px;
      background: linear-gradient(135deg, #6C63FF, #00c9a7);
      color: #fff;
      border: none;
      border-radius: 50px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
    }
    button:hover { opacity: 0.85; transform: scale(1.03); transition: 0.2s; }
  </style>
</head>
<body>
  <h1>Hello, World! 👋</h1>
  <p>Start coding your interactive bot app here. Use HTML, CSS, and JavaScript freely.</p>
  <button onclick="alert('It works! 🎉')">Click Me</button>
</body>
</html>`;

export default function AgentBuilder({ onClose, onCreated }) {
  const { user } = useAuthStore();
  const { addBot } = useChatStore();

  // Mode: 'ai' = non-coder prompt mode | 'dev' = raw code editor mode
  const [builderMode, setBuilderMode] = useState('ai');

  // Architect Chat State
  const [messages, setMessages] = useState([
    { role: 'architect', text: 'Hi! I am the Architect. Describe the bot or tool you want to build (e.g. "A Snake game bot" or "A live crypto price tracker"), and I will write the code and prompt for you.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const endRef = useRef(null);

  // Config State (Under the Hood)
  const [config, setConfig] = useState({
    name: 'New Bot',
    emoji: '🤖',
    tag: 'Custom',
    type: 'utility',
    prompt: '',
    tools: [],
    custom_code: '',
  });

  // Dev Mode — live HTML editor state
  const [customHtml, setCustomHtml] = useState(DEFAULT_HTML);
  const [htmlTitle, setHtmlTitle] = useState('My App');
  const [livePreviewKey, setLivePreviewKey] = useState(0); // force re-render

  const [saving, setSaving] = useState(false);
  const [activeConfigTab, setActiveConfigTab] = useState('prompt'); // 'prompt' | 'code' | 'tools'

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Debounced live preview update for Dev Mode
  useEffect(() => {
    if (builderMode !== 'dev') return;
    const t = setTimeout(() => setLivePreviewKey(k => k + 1), 800);
    return () => clearTimeout(t);
  }, [customHtml, builderMode]);

  const handleSendToArchitect = async () => {
    if (!chatInput.trim() || generating) return;
    const prompt = chatInput.trim();
    setChatInput('');
    setMessages(p => [...p, { role: 'user', text: prompt }]);
    setGenerating(true);

    try {
      const res = await fetch(`${BASE}/api/agent/architect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: prompt })
      });
      const data = await res.json();

      if (data.config) {
        setConfig(prev => ({ ...prev, ...data.config }));
        setMessages(p => [...p, { role: 'architect', text: `✅ Done! I've configured "${data.config.name}" for you. Test it in the Live Preview → center panel. Then Publish when ready!` }]);
      } else {
        throw new Error(data.error || 'No config returned');
      }
    } catch (e) {
      setMessages(p => [...p, { role: 'architect', text: `❌ Error: ${e.message}` }]);
    }
    setGenerating(false);
  };

  const handleSaveBot = async () => {
    setSaving(true);
    try {
      const dbPayload = {
        name: config.name,
        emoji: config.emoji,
        type: config.type,
        prompt: builderMode === 'dev'
          ? `You are ${config.name || 'a custom app'}. Greet the user and launch the app for them.`
          : config.prompt,
        tag: config.tag || 'Custom',
        tools: config.tools || [],
        // In Dev Mode, encode the full HTML artifact into custom_code with a special prefix
        custom_code: builderMode === 'dev'
          ? `/* ARTIFACT_HTML:${htmlTitle} */\n${customHtml}`
          : (config.custom_code || null),
        creator_id: user?.id,
        creator_name: user?.user_metadata?.full_name || 'Anonymous',
        is_public: true,
      };

      const res = await createBot(dbPayload);
      addBot(res.bot);
      onCreated?.(res.bot);
    } catch (e) {
      alert('Failed to publish: ' + e.message);
    }
    setSaving(false);
  };

  const handleToolToggle = (toolId) => {
    setConfig(prev => ({
      ...prev,
      tools: prev.tools.includes(toolId)
        ? prev.tools.filter(t => t !== toolId)
        : [...prev.tools, toolId]
    }));
  };

  const tabStyle = (active) => ({
    flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 700, border: 'none',
    cursor: 'pointer', background: active ? '#6C63FF' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
    borderRadius: 6, transition: 'all 0.2s',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050912', zIndex: 100, display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#0b0f1a', borderBottom: '1px solid #1a1d2e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer', fontSize: 22, padding: '0 6px' }}>✕</button>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>🏗️ Agent Builder Studio</div>
        </div>

        {/* Mode Toggle — the key feature */}
        <div style={{ display: 'flex', background: '#1a1d2e', borderRadius: 8, overflow: 'hidden', border: '1px solid #2a2d45' }}>
          <button onClick={() => setBuilderMode('ai')}
            style={{ padding: '7px 20px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: builderMode === 'ai' ? '#6C63FF' : 'transparent', color: builderMode === 'ai' ? '#fff' : 'var(--text-muted)' }}>
            🤖 AI Mode
          </button>
          <button onClick={() => setBuilderMode('dev')}
            style={{ padding: '7px 20px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: builderMode === 'dev' ? '#00c9a7' : 'transparent', color: builderMode === 'dev' ? '#0a0b14' : 'var(--text-muted)' }}>
            {'</>'} Dev Mode
          </button>
        </div>

        <button onClick={handleSaveBot} disabled={saving || !config.name}
          style={{ padding: '8px 20px', background: 'linear-gradient(135deg, #6C63FF, #00c9a7)', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 8, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Publishing...' : '🚀 Publish'}
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* PANEL 1: Left — AI Chat (AI Mode) or Bot Info (Dev Mode) */}
        <div style={{ flex: '0 0 28%', borderRight: '1px solid #1a1d2e', display: 'flex', flexDirection: 'column', background: '#080a12', minHeight: 0 }}>
          <div style={{ flexShrink: 0, padding: '12px 16px', background: '#111425', borderBottom: '1px solid #2a2d45', color: builderMode === 'ai' ? '#5ac8fa' : '#00c9a7', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{builderMode === 'ai' ? '🧠' : '🎨'}</span>
            {builderMode === 'ai' ? 'The Architect' : 'Bot Identity'}
          </div>

          {builderMode === 'ai' ? (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.5, background: m.role === 'user' ? '#6C63FF' : '#1a1d2e', color: '#fff', maxWidth: '92%' }}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {generating && (
                  <div style={{ color: '#5ac8fa', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</span>
                    Generating your app...
                  </div>
                )}
                <div ref={endRef} />
              </div>
              <div style={{ padding: 12, borderTop: '1px solid #1a1d2e', display: 'flex', gap: 8 }}>
                <input
                  value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendToArchitect()}
                  placeholder="E.g. Make a Snake game bot..."
                  style={{ flex: 1, background: '#1a1d2e', border: 'none', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none' }}
                />
                <button onClick={handleSendToArchitect} disabled={generating}
                  style={{ background: '#6C63FF', border: 'none', borderRadius: 8, padding: '0 14px', color: '#fff', cursor: 'pointer', fontSize: 16 }}>
                  ➤
                </button>
              </div>
            </>
          ) : (
            /* Dev Mode — Bot Identity Panel */
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>BOT INFO</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={config.emoji} onChange={e => setConfig({...config, emoji: e.target.value})}
                  style={{ width: 48, textAlign: 'center', background: '#1a1d2e', border: 'none', borderRadius: 8, color: '#fff', fontSize: 18, padding: 6 }} />
                <input value={config.name} onChange={e => setConfig({...config, name: e.target.value})}
                  placeholder="Bot Name" style={{ flex: 1, background: '#1a1d2e', border: 'none', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 14, outline: 'none' }} />
              </div>
              <input value={config.tag} onChange={e => setConfig({...config, tag: e.target.value})}
                placeholder="Category (e.g. Games, Tools)" style={{ background: '#1a1d2e', border: 'none', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, outline: 'none' }} />

              <div style={{ borderTop: '1px solid #1a1d2e', paddingTop: 14 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, marginBottom: 8 }}>APP WINDOW TITLE</div>
                <input value={htmlTitle} onChange={e => setHtmlTitle(e.target.value)}
                  placeholder="e.g. Snake Game" style={{ width: '100%', background: '#1a1d2e', border: 'none', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, outline: 'none' }} />
              </div>

              <div style={{ borderTop: '1px solid #1a1d2e', paddingTop: 14 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, marginBottom: 8 }}>BOT GREETING</div>
                <textarea value={config.prompt} onChange={e => setConfig({...config, prompt: e.target.value})}
                  placeholder="Optional: describe what this bot says when users talk to it..."
                  style={{ width: '100%', height: 90, background: '#1a1d2e', border: 'none', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 12, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ background: '#00c9a733', border: '1px solid #00c9a755', borderRadius: 8, padding: 12, fontSize: 12, color: '#00c9a7', lineHeight: 1.6 }}>
                💡 <strong>Dev Mode:</strong> Write your app's HTML/CSS/JS in the center editor. The preview updates live as you type. When published, users will see your app in the chat.
              </div>
            </div>
          )}
        </div>

        {/* PANEL 2: Center — Live Preview (AI Mode) or Code Editor (Dev Mode) */}
        <div style={{ flex: '0 0 44%', borderRight: '1px solid #1a1d2e', display: 'flex', flexDirection: 'column', background: '#0a0d1a', position: 'relative', minHeight: 0 }}>
          <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: '1px solid #1a1d2e', color: builderMode === 'ai' ? '#00c9a7' : '#ff9f43', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{builderMode === 'ai' ? '👀' : '💻'}</span>
            {builderMode === 'ai' ? 'Live Preview — test your bot' : 'Code Editor — write your app'}
          </div>

          {builderMode === 'ai' ? (
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0 }}>
                <CharacterChat bot={{ ...config, id: 'preview-bot' }} onBack={() => {}} userId={user?.id} displayName={user?.user_metadata?.full_name || 'You'} />
              </div>
              <div style={{ position: 'absolute', top: 12, left: 12, width: 40, height: 40, background: 'var(--bg-surface)', zIndex: 10 }} />
            </div>
          ) : (
            /* Dev Mode — Full HTML Code Editor */
            <textarea
              value={customHtml}
              onChange={e => setCustomHtml(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1, width: '100%', height: '100%',
                background: '#05070d', border: 'none', outline: 'none',
                color: '#a8f0c6', fontSize: 13, fontFamily: '"Fira Code", "Cascadia Code", monospace',
                lineHeight: 1.7, padding: '16px 20px',
                resize: 'none', overflowY: 'auto', tabSize: 2,
              }}
            />
          )}
        </div>

        {/* PANEL 3: Right — Config (AI) or Live App Preview (Dev) */}
        <div style={{ flex: '0 0 28%', display: 'flex', flexDirection: 'column', background: '#05070d', minHeight: 0 }}>
          <div style={{ flexShrink: 0, padding: '12px 16px', background: '#0a0d1a', borderBottom: '1px solid #1a1d2e', color: '#ff9f43', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚙️</span>
            {builderMode === 'ai' ? 'Under the Hood' : 'Live App Preview'}
          </div>

          {builderMode === 'ai' ? (
            /* AI Mode — config panel */
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

              {/* Bot Info */}
              <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, marginBottom: 8 }}>BOT INFO</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input value={config.emoji} onChange={e => setConfig({...config, emoji: e.target.value})}
                  style={{ width: 48, textAlign: 'center', background: '#1a1d2e', border: 'none', borderRadius: 8, color: '#fff', fontSize: 16, padding: 6 }} />
                <input value={config.name} onChange={e => setConfig({...config, name: e.target.value})}
                  placeholder="Bot Name" style={{ flex: 1, background: '#1a1d2e', border: 'none', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 13, outline: 'none' }} />
                <input value={config.tag} onChange={e => setConfig({...config, tag: e.target.value})}
                  placeholder="Tag" style={{ width: 70, background: '#1a1d2e', border: 'none', borderRadius: 8, padding: '8px', color: '#fff', fontSize: 12, outline: 'none' }} />
              </div>

              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#0a0d1a', padding: 4, borderRadius: 8 }}>
                <button onClick={() => setActiveConfigTab('prompt')} style={tabStyle(activeConfigTab === 'prompt')}>Prompt</button>
                <button onClick={() => setActiveConfigTab('code')} style={tabStyle(activeConfigTab === 'code')}>JS Code</button>
                <button onClick={() => setActiveConfigTab('tools')} style={tabStyle(activeConfigTab === 'tools')}>Tools</button>
              </div>

              {activeConfigTab === 'prompt' && (
                <>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, marginBottom: 6 }}>SYSTEM PROMPT</div>
                  <textarea value={config.prompt} onChange={e => setConfig({...config, prompt: e.target.value})}
                    placeholder="Describe what your bot does and how it should behave..."
                    style={{ width: '100%', height: 200, background: '#1a1d2e', border: 'none', borderRadius: 8, padding: '10px', color: '#fff', fontSize: 12, resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6 }}
                  />
                </>
              )}

              {activeConfigTab === 'code' && (
                <>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, marginBottom: 4 }}>CUSTOM JS CODE (SANDBOX)</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 8 }}>Runs on backend. Sets <code style={{ color: '#ff9f43' }}>__PAYLOAD</code> for live data.</div>
                  <textarea value={config.custom_code || ''} onChange={e => setConfig({...config, custom_code: e.target.value})}
                    placeholder={"(async () => { __PAYLOAD = 'hello'; })();"}
                    style={{ width: '100%', height: 200, background: '#0a0d1a', border: '1px solid #2a2d45', borderRadius: 8, padding: '10px', color: '#ff9f43', fontSize: 12, fontFamily: 'monospace', resize: 'vertical', outline: 'none' }}
                  />
                </>
              )}

              {activeConfigTab === 'tools' && (
                <>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, marginBottom: 10 }}>WORKSPACE CAPABILITIES</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ALL_TOOLS.map(t => {
                      const active = config.tools.includes(t.id);
                      return (
                        <button key={t.id} onClick={() => handleToolToggle(t.id)}
                          style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', textAlign: 'left', background: active ? '#6C63FF22' : '#1a1d2e', border: `1px solid ${active ? '#6C63FF' : 'transparent'}`, color: active ? '#6C63FF' : 'var(--text-secondary)' }}>
                          {t.label} {active && '✓'}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Dev Mode — Live rendered preview of the custom HTML */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: '8px 12px', background: '#080a12', borderBottom: '1px solid #1a1d2e', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00c9a7', display: 'inline-block' }} />
                Updates live as you type
              </div>
              <iframe
                key={livePreviewKey}
                srcDoc={customHtml}
                sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-modals"
                style={{ flex: 1, border: 'none', background: '#fff' }}
                title="App Preview"
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
