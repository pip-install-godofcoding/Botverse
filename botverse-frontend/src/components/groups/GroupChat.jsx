import React, { useState, useRef, useEffect, useMemo } from 'react';
import { socket } from '../../lib/socket';
import { saveGroupMessageDirect } from '../../lib/supabaseGroups';
import { useChatStore } from '../../store/chatStore';
import { parseGenerativeUI } from '../../lib/uiParser';
import AdaptiveUI from '../chat/ui/AdaptiveUI';
import ArtifactViewer from '../chat/ui/ArtifactViewer';
import YouTubeRoom from '../media/YouTubeRoom';
import SpotifyRoom from '../media/SpotifyRoom';

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function GroupChat({ group, onBack, userId, displayName, avatarUrl }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [members, setMembers] = useState([]);
  const [typingBot, setTypingBot] = useState(null);
  const [botObjects, setBotObjects] = useState([]);
  const [activeMedia, setActiveMedia] = useState(null); // 'youtube' | 'spotify'
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const botIds = group.bot_ids || [];
  
  // Two stable selectors — spreading inside a selector creates a new ref every render → infinite loop
  const storeBots = useChatStore(state => state.bots);
  const storeMediaBots = useChatStore(state => state.mediaBots);
  const allKnownBots = useMemo(() => [...storeBots, ...storeMediaBots], [storeBots, storeMediaBots]);

  // ── Load real bot objects so we can @mention them properly ──
  useEffect(() => {
    if (botIds.length === 0) return;
    // Match bots in this group by id or name from our known global list
    const groupBots = allKnownBots.filter(b =>
      botIds.some(bid => bid === b.id || bid === b.name || bid.toLowerCase() === b.name.toLowerCase())
    );
    setBotObjects(groupBots);
  }, [group.id, botIds, allKnownBots]);

  useEffect(() => {
    socket.emit('join-group', { groupId: group.id, userId, displayName, avatarUrl });

    setMessages([{
      id: 'join', type: 'system',
      text: `You joined ${group.name}. Mention a bot with @BotName to chat with it!`,
    }]);

    socket.on('group-msg', (msg) => {
      setMessages(prev => [...prev, { ...msg, type: 'user' }]);
    });

    socket.on('bot-typing', ({ botName, botEmoji }) => {
      setTypingBot({ name: botName, emoji: botEmoji });
    });

    socket.on('bot-reply', (msg) => {
      setTypingBot(null);
      const { cleanText, uiPayload, artifactPayload } = parseGenerativeUI(msg.text);
      setMessages(prev => [...prev, { ...msg, text: cleanText, uiPayload, artifactPayload, type: 'bot' }]);
    });

    socket.on('user-joined', ({ displayName: name, members: m }) => {
      setMembers(m);
      setMessages(prev => [...prev, { id: Date.now(), type: 'system', text: `👋 ${name} joined` }]);
    });

    socket.on('user-left', ({ displayName: name, members: m }) => {
      setMembers(m);
      setMessages(prev => [...prev, { id: Date.now(), type: 'system', text: `${name} left` }]);
    });

    return () => {
      socket.emit('leave-group', { groupId: group.id });
      socket.off('group-msg');
      socket.off('bot-typing');
      socket.off('bot-reply');
      socket.off('user-joined');
      socket.off('user-left');
    };
  }, [group.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typingBot]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');

    // Emit via socket — pass full bot objects so server can @mention-match
    socket.emit('group-msg', {
      groupId: group.id,
      userId,
      displayName,
      avatarUrl,
      text,
      bots: botObjects.map(b => ({
        id: b.id,
        name: b.name,
        emoji: b.emoji,
        color: b.color,
        prompt: b.prompt,
        type: b.type,
      })),
    });

    // Persist to DB
    if (userId) {
      saveGroupMessageDirect(group.id, { user_id: userId, content: text, role: 'user', display_name: displayName }).catch(() => {});
    }
  };

  const MsgBubble = ({ msg }) => {
    const isMe = msg.userId === userId;

    if (msg.type === 'system') {
      return (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic', padding: '4px 20px' }}>
          {msg.text}
        </div>
      );
    }

    if (msg.type === 'bot') {
      return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 6, animation: 'fadeIn 0.18s ease' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${msg.botColor || '#6C63FF'}cc, ${msg.botColor || '#6C63FF'}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
            {msg.botEmoji || '🤖'}
          </div>
          <div style={{ maxWidth: '72%' }}>
            <div style={{ color: msg.botColor || 'var(--accent)', fontSize: 11.5, fontWeight: 700, marginBottom: 2 }}>{msg.botName}</div>
            <div style={{ background: 'var(--bg-overlay)', color: 'var(--text-primary)', padding: '9px 12px 6px', borderRadius: '3px 16px 16px 16px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {msg.text}
              
              {/* Generative UI Block in Group Chat */}
              {msg.uiPayload && (
                <AdaptiveUI 
                  payload={msg.uiPayload} 
                  currentUser={displayName} 
                  onAction={(action) => {
                    setInput(action);
                    if(inputRef.current) inputRef.current.focus();
                  }} 
                />
              )}

              {/* Artifact: Full Live App in Group Chat */}
              {msg.artifactPayload && (
                <ArtifactViewer artifact={msg.artifactPayload} botName={msg.botName} />
              )}

              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, textAlign: 'right' }}>{msg.time}</div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginTop: 3, animation: 'fadeIn 0.15s ease' }}>
        {!isMe && (
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #5ac8fa, #7b61ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#0a0b14', flexShrink: 0 }}>
            {msg.displayName?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div style={{ maxWidth: '72%' }}>
          {!isMe && <div style={{ color: 'var(--accent)', fontSize: 11.5, fontWeight: 700, marginBottom: 2 }}>{msg.displayName}</div>}
          <div style={{ background: isMe ? 'linear-gradient(135deg, var(--accent)cc, #7b61ffcc)' : 'var(--bg-overlay)', color: 'var(--text-primary)', padding: '9px 12px 6px', borderRadius: isMe ? '16px 3px 16px 16px' : '3px 16px 16px 16px', fontSize: 14, lineHeight: 1.5, boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
            {msg.text}
            <div style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)', marginTop: 2, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
              {msg.time} {isMe && <span style={{ fontSize: 11 }}>✓✓</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', position: 'relative' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 28, lineHeight: 1 }}>‹</button>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #2a2d45, #1a1d2e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
          {group.emoji || '💬'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15.5 }}>{group.name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            {members.length > 0 ? `${members.length} online` : 'group chat'}
            {botIds.length > 0 && ` · ${botIds.length} bot${botIds.length > 1 ? 's' : ''}`}
          </div>
        </div>
        {/* Invite code */}
        {group.invite_code && (
          <button
            onClick={() => { navigator.clipboard.writeText(group.invite_code); }}
            title={`Invite code: ${group.invite_code} (click to copy)`}
            style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            🔗 {group.invite_code}
          </button>
        )}
      </div>

      {/* Bot list hint */}
      {botIds.length > 0 && (
        <div style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)', padding: '6px 14px', display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', flexShrink: 0 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>BOTS:</span>
          {botObjects.length > 0 ? botObjects.map((bot) => {
            const isMedia = bot.type === 'youtube' || bot.type === 'spotify';
            return (
              <button
                key={bot.id}
                onClick={() => isMedia ? setActiveMedia(bot.type) : setInput(v => v + `@${bot.name} `)}
                style={{ background: `${bot.color || '#6C63FF'}22`, border: `1px solid ${bot.color || '#6C63FF'}66`, borderRadius: 20, padding: '3px 10px', color: bot.color || 'var(--accent)', fontSize: 12, flexShrink: 0, cursor: 'pointer', fontWeight: 600 }}
              >
                {bot.emoji} {isMedia ? `Open ${bot.name}` : `@${bot.name}`}
              </button>
            );
          }) : botIds.map((bid, i) => (
            <span key={i} style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 10px', color: 'var(--text-secondary)', fontSize: 12, flexShrink: 0 }}>@{bid}</span>
          ))}
          <span style={{ color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>· tap a bot name to mention</span>
        </div>
      )}

      {/* Media room overlay */}
      {activeMedia === 'youtube' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
          <YouTubeRoom onBack={() => setActiveMedia(null)} userId={userId} displayName={displayName} />
        </div>
      )}
      {activeMedia === 'spotify' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
          <SpotifyRoom onBack={() => setActiveMedia(null)} userId={userId} displayName={displayName} />
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {messages.map((msg, i) => <MsgBubble key={msg.id || i} msg={msg} />)}

        {/* Bot typing indicator */}
        {typingBot && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 6, animation: 'fadeIn 0.18s ease' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
              {typingBot.emoji || '🤖'}
            </div>
            <div style={{ background: 'var(--bg-overlay)', padding: '10px 14px', borderRadius: '3px 16px 16px 16px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: `tydot 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                ))}
              </div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 11.5, fontStyle: 'italic' }}>{typingBot.name} is typing...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)', padding: '10px 12px 12px', display: 'flex', gap: 8, flexShrink: 0 }}>
        <div style={{ flex: 1, background: 'var(--bg-overlay)', borderRadius: 22, display: 'flex', alignItems: 'center', padding: '0 14px', border: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            id="group-chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Message group... @BotName to mention"
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 15, outline: 'none', padding: '11px 0' }}
          />
        </div>
        <button
          onClick={send}
          disabled={!input.trim()}
          style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: input.trim() ? 'var(--accent)' : 'var(--bg-overlay)', color: input.trim() ? '#0a0b14' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default', transition: 'background 0.2s', flexShrink: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke={input.trim() ? '#0a0b14' : 'var(--text-muted)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
