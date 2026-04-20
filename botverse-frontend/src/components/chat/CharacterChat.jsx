import React, { useState, useRef, useEffect } from 'react';
import { BotAvatar } from '../bots/BotAvatar';
import { sendMessage, fetchBotMessages, saveBotMessage } from '../../lib/api';
import { parseGenerativeUI } from '../../lib/uiParser';
import AdaptiveUI from './ui/AdaptiveUI';
import ArtifactViewer from './ui/ArtifactViewer';

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function TypingDots({ color }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '4px 2px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: color || 'var(--accent)', opacity: 0.8,
          animation: `tydot 1.2s ${i * 0.2}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

export default function CharacterChat({ bot, onBack, userId, displayName, enableDocs, onAIResponse }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [documentContext, setDocumentContext] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load conversation history
  useEffect(() => {
    async function loadHistory() {
      // If no userId (demo mode), start fresh
      if (!userId || bot.is_builtin === undefined) {
        setMessages([{
          id: 1, role: 'assistant',
          content: `${bot.emoji} Hey! I'm ${bot.name}. What's up?`,
          time: getTime(),
        }]);
        setLoadingHistory(false);
        return;
      }
      try {
        const { messages: hist } = await fetchBotMessages(bot.id, userId);
        if (hist.length > 0) {
          setMessages(hist.map(m => ({ ...m, time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })));
        } else {
          setMessages([{
            id: 'intro', role: 'assistant',
            content: `${bot.emoji} Hey! I'm ${bot.name}. What's up?`,
            time: getTime(),
          }]);
        }
      } catch {
        setMessages([{
          id: 'intro', role: 'assistant',
          content: `${bot.emoji} Hey! I'm ${bot.name}. What's up?`,
          time: getTime(),
        }]);
      }
      setLoadingHistory(false);
    }
    loadHistory();
  }, [bot.id, userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setLoading(true);

    const userMsg = { id: Date.now(), role: 'user', content: text, time: getTime() };
    setMessages(prev => [...prev, userMsg]);

    // Save user message to DB
    if (userId && bot.id && !bot.id.startsWith('demo')) {
      saveBotMessage(bot.id, { user_id: userId, role: 'user', content: text }).catch(() => {});
    }

    try {
      // ─── Dev Mode Bot: serve HTML artifact directly, no AI call needed ───────
      const ARTIFACT_MARKER = '/* ARTIFACT_HTML:';
      if (bot.custom_code && bot.custom_code.startsWith(ARTIFACT_MARKER)) {
        const firstNewline = bot.custom_code.indexOf('\n');
        const titleLine = bot.custom_code.substring(ARTIFACT_MARKER.length, firstNewline - 3).trim(); // strip " */"
        const htmlCode = bot.custom_code.substring(firstNewline + 1).trim();
        const botMsg = {
          id: Date.now() + 1, role: 'assistant',
          content: `Here is your ${titleLine}! Click fullscreen (⛶) for the best experience.`,
          artifactPayload: { type: 'html', title: titleLine, code: htmlCode },
          time: getTime(),
        };
        setMessages(prev => [...prev, botMsg]);
        setLoading(false);
        inputRef.current?.focus();
        return;
      }

      // Build history for context (exclude the intro message)
      const history = messages.filter(m => m.id !== 'intro' && m.id !== 1).map(m => ({
        role: m.role, content: m.content,
      }));

      let { reply } = await sendMessage({
        botPrompt: bot.prompt,
        botType: bot.type,
        botName: bot.name,
        history,
        message: text,
        documentContext: documentContext,
      });

      // Pass through interceptor for things like JSON PPT extraction
      if (onAIResponse) {
        reply = onAIResponse(reply);
      }

      const { cleanText, uiPayload, artifactPayload } = parseGenerativeUI(reply);

      const botMsg = { id: Date.now() + 1, role: 'assistant', content: cleanText, uiPayload, artifactPayload, time: getTime() };
      setMessages(prev => [...prev, botMsg]);

      // Clear document context after use
      setDocumentContext('');
      setDocumentName('');

      // Save bot reply to DB
      if (userId && bot.id && !bot.id.startsWith('demo')) {
        saveBotMessage(bot.id, { user_id: userId, role: 'assistant', content: reply }).catch(() => {});
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        content: '⚠️ Something went wrong. Make sure the backend is running.',
        time: getTime(),
      }]);
    }

    setLoading(false);
    inputRef.current?.focus();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:3001/api/chat/upload-document', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.text) {
        setDocumentContext(data.text);
        setDocumentName(file.name);
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (err) {
      alert('Failed to upload document.');
    }
    setIsUploading(false);
    // Reset the input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const botColor = bot.color || 'var(--accent)';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>

      {/* Header */}
      <div style={{
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: botColor, fontSize: 28, lineHeight: 1, padding: '0 4px 0 0' }}
        >
          ‹
        </button>
        <BotAvatar bot={bot} size={40} showOnline />
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15.5 }}>{bot.name}</div>
          <div style={{ color: 'var(--green)', fontSize: 11.5 }}>● online</div>
        </div>
        <button
          onClick={() => setShowInfo(v => !v)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22 }}
        >
          ⋮
        </button>
      </div>

      {/* Bot info panel */}
      {showInfo && (
        <div style={{
          background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)',
          padding: '14px 16px', animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <BotAvatar bot={bot} size={44} />
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: 4 }}>{bot.name}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
                {bot.prompt.slice(0, 120)}...
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <span style={{ background: `${botColor}22`, color: botColor, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>
                  #{bot.tag}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>by {bot.creator_name || 'BotVerse'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loadingHistory ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: botColor, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const showAvatar = !isUser && (i === 0 || messages[i - 1]?.role === 'user');

            return (
              <div key={msg.id} style={{
                display: 'flex',
                flexDirection: isUser ? 'row-reverse' : 'row',
                alignItems: 'flex-end', gap: 7,
                marginTop: showAvatar && i > 0 ? 10 : 2,
                animation: 'fadeIn 0.18s ease',
              }}>
                {/* Bot avatar spacer */}
                {!isUser && (
                  <div style={{ width: 28, flexShrink: 0 }}>
                    {showAvatar && <BotAvatar bot={bot} size={28} />}
                  </div>
                )}

                <div style={{ maxWidth: '74%' }}>
                  <div style={{
                    background: isUser
                      ? `linear-gradient(135deg, ${botColor}e0, ${botColor}99)`
                      : 'var(--bg-overlay)',
                    color: 'var(--text-primary)',
                    padding: '9px 12px 6px',
                    borderRadius: isUser ? '16px 3px 16px 16px' : '3px 16px 16px 16px',
                    fontSize: 14.5, lineHeight: 1.5,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.content}
                    
                    {/* Generative UI Block */}
                    {msg.uiPayload && (
                      <AdaptiveUI 
                        payload={msg.uiPayload} 
                        currentUser={displayName} 
                        onAction={(action) => {
                          setInput(action);
                          setTimeout(() => { if(inputRef.current) inputRef.current.focus(); }, 10);
                        }} 
                      />
                    )}

                    {/* Artifact: Full Live App Renderer */}
                    {msg.artifactPayload && (
                      <ArtifactViewer artifact={msg.artifactPayload} botName={bot.name} />
                    )}

                    <div style={{
                      fontSize: 10.5, marginTop: 3, textAlign: 'right',
                      color: isUser ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3,
                    }}>
                      {msg.time}
                      {isUser && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>✓✓</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, marginTop: 10, animation: 'fadeIn 0.18s ease' }}>
            <BotAvatar bot={bot} size={28} />
            <div style={{
              background: 'var(--bg-overlay)', padding: '10px 14px',
              borderRadius: '3px 16px 16px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}>
              <TypingDots color={botColor} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{
        background: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '10px 12px 12px',
        display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
      }}>
        {documentName && (
          <div style={{ background: '#fa243c22', display: 'flex', alignItems: 'center', padding: '6px 12px', borderRadius: 6, gap: 8 }}>
            <span style={{ color: '#fa243c', fontSize: 13, fontWeight: 600 }}>📎 {documentName}</span>
            <button onClick={() => { setDocumentContext(''); setDocumentName(''); }} style={{ background: 'none', border: 'none', color: '#fa243c', cursor: 'pointer', marginLeft: 'auto' }}>✖</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {enableDocs && (
            <>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.txt" style={{ display: 'none' }} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || loading}
                title="Attach Document (PDF/TXT)"
                style={{
                  width: 44, height: 44, borderRadius: '50%', border: 'none',
                  background: isUploading ? 'var(--bg-overlay)' : '#1a2e1d',
                  color: isUploading ? 'var(--text-muted)' : '#39ff14',
                  fontSize: 20, cursor: isUploading || loading ? 'default' : 'pointer', flexShrink: 0,
                }}
              >
                📎
              </button>
            </>
          )}

          <div style={{
            flex: 1, background: 'var(--bg-overlay)', borderRadius: 22,
            display: 'flex', alignItems: 'center', padding: '0 14px',
            border: '1px solid var(--border)',
          }}>
            <input
              ref={inputRef}
            id="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={`Message ${bot.name}...`}
            style={{
              flex: 1, background: 'none', border: 'none',
              color: 'var(--text-primary)', fontSize: 15, outline: 'none',
              padding: '11px 0',
            }}
          />
          <button style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>😊</button>
        </div>
        <button
          id="send-btn"
          onClick={send}
          disabled={!input.trim() || loading}
          style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none',
            background: input.trim() && !loading ? botColor : 'var(--bg-overlay)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            transition: 'background 0.2s, transform 0.1s',
            flexShrink: 0,
          }}
          onMouseEnter={e => { if (input.trim()) e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
              stroke={input.trim() ? '#fff' : 'var(--text-muted)'}
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        </div>
      </div>
    </div>
  );
}
