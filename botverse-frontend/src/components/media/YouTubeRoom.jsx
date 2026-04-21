import React, { useState, useRef, useEffect, useCallback } from 'react';
import { socket } from '../../lib/socket';
import { searchYouTube } from '../../lib/api';

const ROOM_ID = 'global-watch';

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function YouTubeRoom({ onBack, userId, displayName }) {
  const [videoId, setVideoId] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, from: 'system', text: '🎬 Welcome to Watch Together! Paste a YouTube link or search for a video.', time: getTime() },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [members, setMembers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const endRef = useRef(null);
  const iframeRef = useRef(null);
  const searchTimeout = useRef(null);

  // Join room on mount
  useEffect(() => {
    socket.emit('join-watch', { roomId: ROOM_ID, userId, displayName });

    socket.on('room-state', (state) => {
      setMembers(state.members);
      setIsHost(state.isHost);
      if (state.videoId) setVideoId(state.videoId);
    });

    socket.on('user-joined', (data) => {
      setMembers(data.members);
      setMessages(prev => [...prev, { id: Date.now(), from: 'system', text: `👋 ${data.displayName} joined`, time: getTime() }]);
    });

    socket.on('user-left', (data) => {
      setMembers(data.members);
      setMessages(prev => [...prev, { id: Date.now(), from: 'system', text: `${data.displayName} left`, time: getTime() }]);
    });

    socket.on('video-loaded', ({ videoId, loadedBy }) => {
      setVideoId(videoId);
      setMessages(prev => [...prev, { id: Date.now(), from: 'system', text: `▶️ ${loadedBy} loaded a video`, time: getTime() }]);
    });

    socket.on('watch-chat', (msg) => {
      setMessages(prev => [...prev, { ...msg, from: msg.userId === userId ? 'me' : 'other' }]);
    });

    socket.on('you-are-host', () => setIsHost(true));

    return () => {
      socket.emit('leave-watch', { roomId: ROOM_ID });
      socket.off('room-state');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('video-loaded');
      socket.off('watch-chat');
      socket.off('you-are-host');
    };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // YouTube search with debounce
  const handleSearchChange = (q) => {
    setSearchQuery(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { results } = await searchYouTube(q);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 600);
  };

  const loadVideo = (id) => {
    setVideoId(id);
    setShowSearch(false);
    setSearchResults([]);
    setSearchQuery('');
    socket.emit('video-load', { roomId: ROOM_ID, videoId: id });
  };

  const handleUrlLoad = () => {
    const id = extractYouTubeId(urlInput);
    if (id) {
      loadVideo(id);
      setUrlInput('');
    } else {
      setMessages(prev => [...prev, { id: Date.now(), from: 'system', text: '❌ Invalid YouTube link.', time: getTime() }]);
    }
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    socket.emit('watch-chat', { roomId: ROOM_ID, userId, displayName, text: chatInput.trim() });
    setChatInput('');
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0b0f' }}>
      {/* Header */}
      <div style={{ background: '#111218', borderBottom: '1px solid #1a1a25', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#FF4444', fontSize: 28, lineHeight: 1 }}>‹</button>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FF000033', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>▶️</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15 }}>Watch Together</div>
          <div style={{ color: 'var(--green)', fontSize: 11 }}>● {members.length || 1} watching</div>
        </div>
        <button
          onClick={() => setShowSearch(v => !v)}
          style={{ background: showSearch ? '#FF000033' : 'var(--bg-overlay)', border: 'none', color: showSearch ? '#FF4444' : 'var(--text-secondary)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          🔍 Search
        </button>
        <button
          onClick={() => setShowChat(v => !v)}
          style={{ background: 'var(--bg-overlay)', border: 'none', color: showChat ? 'var(--accent)' : 'var(--text-muted)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          💬 Chat
        </button>
      </div>

      <div className="workspace-container" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main area */}
        <div className="workspace-chat" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Video */}
          <div style={{ background: '#000', position: 'relative', width: '100%', flexShrink: 0 }}>
            <div style={{ aspectRatio: '16/9', width: '100%' }}>
              {videoId ? (
                <iframe
                  ref={iframeRef}
                  src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0d0e14', color: 'var(--text-muted)', gap: 12 }}>
                  <div style={{ fontSize: 60 }}>▶️</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Search or paste a YouTube link to start</div>
                </div>
              )}
            </div>
          </div>

          {/* Search panel */}
          {showSearch && (
            <div style={{ background: '#111218', borderBottom: '1px solid #1a1a25', padding: '10px 12px', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: searchResults.length > 0 ? 10 : 0 }}>
                <input
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Search YouTube..."
                  autoFocus
                  style={{ flex: 1, background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13.5, outline: 'none' }}
                />
                {searching && <div style={{ width: 28, height: 28, border: '2px solid var(--border)', borderTopColor: '#FF4444', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0, alignSelf: 'center' }} />}
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {searchResults.map(r => (
                    <button
                      key={r.id}
                      onClick={() => loadVideo(r.id)}
                      style={{ display: 'flex', gap: 10, padding: '8px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-base)'}
                    >
                      <img src={r.thumbnail} alt={r.title} style={{ width: 100, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{r.title}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>{r.channelName}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* URL paste bar */}
          <div style={{ padding: '8px 12px', background: '#111218', borderBottom: '1px solid #1a1a25', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUrlLoad()}
              placeholder="Or paste a YouTube link..."
              style={{ flex: 1, background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13.5, outline: 'none' }}
            />
            <button onClick={handleUrlLoad} style={{ background: '#FF0000', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>Load</button>
          </div>

          {/* Chat when no sidebar */}
          {!showChat && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: msg.from === 'me' ? 'row-reverse' : 'row', gap: 6 }}>
                    <div style={{ background: msg.from === 'me' ? '#FF000099' : msg.from === 'system' ? 'transparent' : 'var(--bg-overlay)', color: msg.from === 'system' ? 'var(--text-muted)' : 'var(--text-primary)', padding: msg.from === 'system' ? '3px 0' : '7px 11px', borderRadius: 10, fontSize: msg.from === 'system' ? 12 : 13.5, maxWidth: '80%', fontStyle: msg.from === 'system' ? 'italic' : 'normal' }}>
                      {msg.from !== 'me' && msg.from !== 'system' && <div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{msg.displayName}</div>}
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div style={{ background: '#111218', borderTop: '1px solid #1a1a25', padding: '8px 10px', display: 'flex', gap: 8, flexShrink: 0 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="React to the video..." style={{ flex: 1, background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 20, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
                <button onClick={sendChat} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#FF0000', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>↑</button>
              </div>
            </>
          )}
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <div className="workspace-panel" style={{ width: 240, background: '#0e0f18', borderLeft: '1px solid #1a1a25', display: 'flex', flexDirection: 'column' }}>
            {/* Members */}
            <div style={{ padding: '8px 10px', borderBottom: '1px solid #1a1a25', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>WATCHING</span>
              {members.slice(0, 5).map((m, i) => (
                <div key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-overlay)', border: '1.5px solid var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-secondary)', marginLeft: i > 0 ? -6 : 0 }}>
                  {m.displayName?.[0]?.toUpperCase() || '?'}
                </div>
              ))}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ marginBottom: 8 }}>
                  {msg.from === 'system' ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 11.5, textAlign: 'center', fontStyle: 'italic', padding: '2px 0' }}>{msg.text}</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, color: msg.from === 'me' ? 'var(--accent)' : '#FF4444', fontWeight: 600, marginBottom: 2 }}>
                        {msg.from === 'me' ? 'You' : msg.displayName || 'User'}
                      </div>
                      <div style={{ background: msg.from === 'me' ? '#FF000033' : 'var(--bg-overlay)', color: 'var(--text-primary)', padding: '6px 9px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.4, border: '1px solid var(--border)' }}>
                        {msg.text}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-placeholder)', marginTop: 2 }}>{msg.time}</div>
                    </>
                  )}
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '8px', borderTop: '1px solid #1a1a25', display: 'flex', gap: 6 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="React..." style={{ flex: 1, background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px', color: 'var(--text-primary)', fontSize: 12.5, outline: 'none' }} />
              <button onClick={sendChat} style={{ background: '#FF0000', border: 'none', borderRadius: 8, padding: '7px 10px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>↑</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
