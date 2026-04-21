import React, { useState, useRef, useEffect } from 'react';
import { socket } from '../../lib/socket';
import { searchSpotify } from '../../lib/api'; // STILL called searchSpotify internally but hits itunes API

const ROOM_ID = 'global-listen';

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function extractMusicEmbed(url) {
  // If it's already an embed url
  if (url.includes('embed.music.apple.com')) return url;
  
  // Convert standard Apple Music URL to embed
  if (url.includes('music.apple.com')) {
    return url.replace('music.apple.com', 'embed.music.apple.com');
  }
  return null;
}

const SEARCH_TYPES = ['track', 'album', 'playlist'];

export default function SpotifyRoom({ onBack, userId, displayName }) {
  const [embedUrl, setEmbedUrl] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchType, setSearchType] = useState('track');
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, from: 'system', text: '🎵 Welcome! Search for a track to listen together.', time: getTime() },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [members, setMembers] = useState([]);
  const endRef = useRef(null);
  const searchTimeout = useRef(null);

  // Join room
  useEffect(() => {
    socket.emit('join-listen', { roomId: ROOM_ID, userId, displayName });

    socket.on('listen-room-state', (state) => {
      setMembers(state.members);
      if (state.currentTrack) {
        setEmbedUrl(state.currentTrack.embedUrl);
        setCurrentTrack(state.currentTrack);
      }
    });

    socket.on('user-joined', (data) => {
      setMembers(data.members);
      setMessages(prev => [...prev, { id: Date.now(), from: 'system', text: `👋 ${data.displayName} joined`, time: getTime() }]);
    });

    socket.on('user-left', (data) => {
      setMembers(data.members);
    });

    socket.on('track-loaded', ({ embedUrl, trackName, artistName, loadedBy }) => {
      setEmbedUrl(embedUrl);
      setCurrentTrack({ trackName, artistName });
      setMessages(prev => [...prev, { id: Date.now(), from: 'system', text: `🎵 ${loadedBy} loaded: ${trackName}${artistName ? ` — ${artistName}` : ''}`, time: getTime() }]);
    });

    socket.on('listen-chat', (msg) => {
      setMessages(prev => [...prev, { ...msg, from: msg.userId === userId ? 'me' : 'other' }]);
    });

    return () => {
      socket.emit('leave-listen', { roomId: ROOM_ID });
      socket.off('listen-room-state');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('track-loaded');
      socket.off('listen-chat');
    };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSearchChange = (q) => {
    setSearchQuery(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { results } = await searchSpotify(q, searchType);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 600);
  };

  const loadTrack = (result) => {
    socket.emit('track-load', {
      roomId: ROOM_ID,
      embedUrl: result.embedUrl,
      trackName: result.name,
      artistName: result.artists || result.owner || '',
    });
    setShowSearch(false);
    setSearchResults([]);
    setSearchQuery('');
  };

  const loadFromUrl = () => {
    const embed = extractMusicEmbed(urlInput);
    if (embed) {
      socket.emit('track-load', { roomId: ROOM_ID, embedUrl: embed, trackName: 'Custom track', artistName: '' });
      setUrlInput('');
    } else {
      setMessages(prev => [...prev, { id: Date.now(), from: 'system', text: '❌ Invalid Apple Music link.', time: getTime() }]);
    }
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    socket.emit('listen-chat', { roomId: ROOM_ID, userId, displayName, text: chatInput.trim() });
    setChatInput('');
  };

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#050e07' }}>
      {/* Header */}
      <div style={{ background: '#0a1a0d', borderBottom: '1px solid #0f2212', padding: '10px 10px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#fa243c', fontSize: 26, lineHeight: 1, paddingRight: 4 }}>‹</button>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fa243c33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🎵</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Listen Together</div>
          <div style={{ color: '#fa243c', fontSize: 10 }}>● {members.length || 1} listening</div>
        </div>
        <button
          onClick={() => setShowSearch(v => !v)}
          style={{ background: showSearch ? '#fa243c33' : 'var(--bg-overlay)', border: 'none', color: showSearch ? '#fa243c' : 'var(--text-secondary)', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          🔍
        </button>
      </div>

      {/* Apple Music embed player */}
      <div style={{ background: '#071009', padding: '14px 14px 10px', flexShrink: 0 }}>
        {embedUrl ? (
          <iframe
            key={embedUrl}
            src={embedUrl}
            width="100%" height="152"
            style={{ borderRadius: 12, border: 'none', background: 'transparent' }}
            allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
            loading="lazy"
          />
        ) : (
          <div style={{ height: 152, borderRadius: 12, background: '#0f1f12', border: '1px solid #1a2e1d', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#4a2a2d', gap: 8 }}>
            <div style={{ fontSize: 44 }}>🎵</div>
            <div style={{ fontSize: 13, color: '#4a2a2d' }}>No track loaded yet</div>
          </div>
        )}
      </div>

      {/* Search panel */}
      {showSearch && (
        <div style={{ background: '#0a1a0d', borderBottom: '1px solid #0f2212', padding: '10px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: searchResults.length > 0 ? 10 : 0 }}>
            <input value={searchQuery} onChange={e => handleSearchChange(e.target.value)} placeholder={`Search tracks...`} autoFocus
              style={{ flex: 1, background: '#0f1f12', border: '1px solid #1a2e1d', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13.5, outline: 'none' }} />
            {searching && <div style={{ width: 28, height: 28, border: '2px solid #1a2e1d', borderTopColor: '#fa243c', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0, alignSelf: 'center' }} />}
          </div>

          {/* Results */}
          {searchResults.length > 0 && (
            <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {searchResults.map(r => (
                <button key={r.id} onClick={() => loadTrack(r)}
                  style={{ display: 'flex', gap: 10, padding: '8px', background: '#0f1f12', border: '1px solid #1a2e1d', borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#2a1619'}
                  onMouseLeave={e => e.currentTarget.style.background = '#0f1f12'}
                >
                  {r.albumArt && <img src={r.albumArt} alt={r.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    <div style={{ color: '#fa243c', fontSize: 11.5 }}>{r.artists || r.owner}</div>
                    {r.albumName && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.albumName}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* URL input */}
      <div style={{ background: '#0a1a0d', borderBottom: '1px solid #0f2212', padding: '8px 14px', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadFromUrl()} placeholder="Or paste Apple Music link..."
          style={{ flex: 1, background: '#0f1f12', border: '1px solid #1a2e1d', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13.5, outline: 'none' }} />
        <button onClick={loadFromUrl} style={{ background: '#fa243c', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>Play</button>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.map(msg => (
          <div key={msg.id}>
            {msg.from === 'system' ? (
              <div style={{ color: '#3a1a1d', fontSize: 11.5, textAlign: 'center', fontStyle: 'italic', padding: '2px 0' }}>{msg.text}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: msg.from === 'me' ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
                {msg.from !== 'me' && (
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#fa243c33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                    {msg.displayName?.[0]?.toUpperCase() || '🎵'}
                  </div>
                )}
                <div style={{ background: msg.from === 'me' ? '#fa243c99' : '#0f1f12', color: 'var(--text-primary)', padding: '8px 11px', borderRadius: 12, fontSize: 13.5, maxWidth: '78%', lineHeight: 1.4, border: msg.from !== 'me' ? '1px solid #1a2e1d' : 'none' }}>
                  {msg.from !== 'me' && <div style={{ color: '#fa243c', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{msg.displayName}</div>}
                  {msg.text}
                  <div style={{ fontSize: 10, color: msg.from === 'me' ? 'rgba(255,255,255,0.4)' : '#3a1a1d', marginTop: 2, textAlign: 'right' }}>{msg.time}</div>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Chat input */}
      <div style={{ background: '#0a1a0d', borderTop: '1px solid #0f2212', padding: '8px 14px 10px', display: 'flex', gap: 8, flexShrink: 0 }}>
        <div style={{ flex: 1, background: '#0f1f12', borderRadius: 22, display: 'flex', alignItems: 'center', padding: '0 14px', border: '1px solid #1a2e1d' }}>
          <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="React to the music... 🎶"
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 14.5, outline: 'none', padding: '10px 0' }} />
        </div>
        <button onClick={sendChat} style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: chatInput.trim() ? '#fa243c' : '#0f1f12', cursor: chatInput.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke={chatInput.trim() ? '#fff' : '#3a1a1d'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
