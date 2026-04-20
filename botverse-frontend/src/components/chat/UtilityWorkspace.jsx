import React, { useState, useEffect } from 'react';
import CharacterChat from './CharacterChat';
import SmartBoard from './tools/SmartBoard';
import SlidePreview from './tools/SlidePreview';
import GameWorkspace from './tools/GameWorkspace';
import VideoEditor from './tools/VideoEditor';

// ─── Determine which tools to show for this bot ───────────────────────────────
function resolveTools(bot) {
  const tools = Array.isArray(bot.tools) ? [...bot.tools] : [];
  const text = `${bot.name} ${bot.prompt || ''}`.toLowerCase();
  const type = bot.type || '';

  // Type-based defaults
  if (type === 'study')        { if (!tools.includes('smartboard')) tools.push('smartboard'); if (!tools.includes('docs')) tools.push('docs'); }
  if (type === 'presentation') { if (!tools.includes('ppt')) tools.push('ppt'); if (!tools.includes('docs')) tools.push('docs'); }
  if (type === 'mom')          { if (!tools.includes('docs')) tools.push('docs'); }

  // Keyword inference — same logic as CreateBotModal
  const BOARD_KW  = ['draw', 'diagram', 'sketch', 'whiteboard', 'board', 'visual', 'canvas', 'flowchart', 'mind map', 'collaborate'];
  const DOC_KW    = ['pdf', 'document', 'notes', 'file', 'analyse', 'analyze', 'summarise', 'summarize', 'upload', 'past papers', 'textbook', 'report'];
  const PPT_KW    = ['ppt', 'powerpoint', 'presentation', 'slide', 'deck', 'keynote'];
  const GAME_KW   = ['game', 'quiz', 'trivia', 'host', 'play', 'challenge', 'question', 'score', 'riddle', 'round'];
  const VIDEO_KW  = ['video', 'edit video', 'trim', 'ffmpeg', 'clip', 'reel', 'footage', 'mp4', 'movie', 'film'];
  const CODE_KW   = ['code', 'run code', 'execute', 'javascript', 'python', 'script', 'programming', 'compiler'];

  if (BOARD_KW.some(w => text.includes(w))  && !tools.includes('smartboard'))  tools.push('smartboard');
  if (DOC_KW.some(w => text.includes(w))    && !tools.includes('docs'))        tools.push('docs');
  if (PPT_KW.some(w => text.includes(w))    && !tools.includes('ppt'))         tools.push('ppt');
  if (GAME_KW.some(w => text.includes(w))   && !tools.includes('game'))        tools.push('game');
  if (VIDEO_KW.some(w => text.includes(w))  && !tools.includes('video_editor'))tools.push('video_editor');
  if (CODE_KW.some(w => text.includes(w))   && !tools.includes('code_runner')) tools.push('code_runner');

  return tools;
}

const TOOL_META = {
  smartboard:   { label: '🎨 Smart Board',       key: 'smartboard'   },
  docs:         { label: '📎 Doc Analysis',       key: 'docs'         },
  ppt:          { label: '📊 Presentation',       key: 'ppt'          },
  game:         { label: '🎮 Game Engine',        key: 'game'         },
  video_editor: { label: '🎬 Video Editor',       key: 'video_editor' },
  code_runner:  { label: '💻 Code Runner',        key: 'code_runner'  },
};

export default function UtilityWorkspace({ bot, onBack, userId, displayName }) {
  const tools = resolveTools(bot);
  const [activeTool, setActiveTool] = useState(tools[0] || null);
  const [presentationData, setPresentationData] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [chatRef, setChatRef] = useState(null);

  // Intercept AI replies for PPT JSON and Game JSON
  const handleAIResponse = (rawString) => {
    // PPT detection
    if (tools.includes('ppt')) {
      try {
        const match = rawString.match(/```json\n?([\s\S]*?)\n?```/);
        const jsonStr = match ? match[1] : rawString;
        const parsed = JSON.parse(jsonStr);
        if (parsed?.slides) {
          setPresentationData(parsed);
          setActiveTool('ppt');
          return '✅ Presentation generated! Click **📊 Presentation** tab to preview and download your .pptx file.';
        }
      } catch {}
    }
    return rawString;
  };

  // Game started from chat (e.g., @mention "start Indian history trivia")
  const handleGameStart = (data) => {
    if (data?.status === 'started') {
      setGameData(data);
      setActiveTool('game');
    }
  };

  const botColor = bot.color || '#6C63FF';

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#050912', overflow: 'hidden' }}>

      {/* LEFT PANEL: Chat */}
      <div style={{ flex: '0 0 38%', minWidth: 300, maxWidth: 420, borderRight: `1px solid ${botColor}33`, display: 'flex', flexDirection: 'column' }}>
        <CharacterChat
          bot={bot}
          onBack={onBack}
          userId={userId}
          displayName={displayName}
          enableDocs={tools.includes('docs')}
          onAIResponse={handleAIResponse}
        />
      </div>

      {/* RIGHT PANEL: Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Tool Tab Bar */}
        {tools.length > 0 && (
          <div style={{ background: '#0a0d1a', borderBottom: `1px solid ${botColor}33`, padding: '0 12px', display: 'flex', gap: 4, flexShrink: 0 }}>
            {tools.map(toolId => {
              const meta = TOOL_META[toolId];
              if (!meta) return null;
              const isActive = activeTool === toolId;
              return (
                <button key={toolId} onClick={() => setActiveTool(toolId)}
                  style={{
                    padding: '10px 16px', background: 'none', border: 'none',
                    borderBottom: isActive ? `2px solid ${botColor}` : '2px solid transparent',
                    color: isActive ? botColor : 'var(--text-muted)',
                    fontWeight: isActive ? 700 : 500, fontSize: 13.5,
                    cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
                  }}>
                  {meta.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Active Tool View */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {activeTool === 'smartboard'   && <SmartBoard boardId={bot.id} />}
          {activeTool === 'ppt'          && <SlidePreview presentationData={presentationData} />}
          {activeTool === 'game'         && (
            <GameWorkspace
              groupId={userId ? `private-${userId}-${bot.id}` : `preview-${bot.id}`}
              botColor={botColor}
              initialGameData={gameData}
              onGameMessage={(msg) => console.log('[game]', msg)}
            />
          )}
          {activeTool === 'video_editor' && (
            <VideoEditor
              bot={bot}
              onSendInstruction={(msg) => console.log('[video]', msg)}
            />
          )}
          {activeTool === 'code_runner'  && (
            <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💻</div>
              <div>Type code in the chat and the bot will run it for you.</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>Example: <code style={{ color: botColor }}>run console.log(2+2)</code></div>
            </div>
          )}
          {activeTool === 'docs'         && (
            <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📎</div>
              <div>Use the 📎 button in the chat panel to attach a PDF or TXT file.</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>The AI will read and analyse it in context.</div>
            </div>
          )}
          {!activeTool && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 12 }}>
              <div style={{ fontSize: 48 }}>🛠️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>No tools configured</div>
              <div style={{ fontSize: 13 }}>This bot's prompt didn't trigger any workspace tools.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
