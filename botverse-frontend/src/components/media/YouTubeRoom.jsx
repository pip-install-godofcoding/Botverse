import React, { useState, useRef, useEffect } from 'react';
import { socket } from '../../lib/socket';
import { searchYouTube } from '../../lib/api';

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

export default function YouTubeRoom({ groupId, userId, displayName, onClose }) {
  const [videoId, setVideoId] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isHost, setIsHost] = useState(false);
  
  const iframeRef = useRef(null);
  const searchTimeout = useRef(null);

  // Join room on mount
  useEffect(() => {
    socket.emit('join-watch', { roomId: groupId, userId, displayName });

    socket.on('room-state', (state) => {
      setIsHost(state.isHost);
      if (state.videoId) setVideoId(state.videoId);
    });

    socket.on('video-loaded', ({ videoId }) => {
      setVideoId(videoId);
    });

    socket.on('you-are-host', () => setIsHost(true));

    return () => {
      socket.emit('leave-watch', { roomId: groupId });
      socket.off('room-state');
      socket.off('video-loaded');
      socket.off('you-are-host');
    };
  }, [groupId, userId, displayName]);

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
    socket.emit('video-load', { roomId: groupId, videoId: id });
  };

  const handleUrlLoad = () => {
    const id = extractYouTubeId(urlInput);
    if (id) {
      loadVideo(id);
      setUrlInput('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', background: '#0a0b0f', borderBottom: '1px solid var(--border-subtle)' }}>
      {/* Video Area (16:9) */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000' }}>
        {/* Close & Controls Overlay */}
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: 8 }}>
          <button onClick={() => setShowSearch(!showSearch)} style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
            🔍 Search
          </button>
          <button onClick={onClose} style={{ background: 'rgba(255,0,0,0.6)', border: 'none', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
            ✕ Close
          </button>
        </div>

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
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 8, color: '#FF0000' }}>▶️</div>
            <div style={{ fontSize: 13 }}>Waiting for video...</div>
          </div>
        )}
      </div>

      {/* Search Panel (Expands downwards) */}
      {showSearch && (
        <div style={{ background: '#111218', padding: '10px 12px', borderBottom: '1px solid #1a1a25' }}>
          {/* Paste URL */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUrlLoad()}
              placeholder="Paste a YouTube link..."
              style={{ flex: 1, background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
            />
            <button onClick={handleUrlLoad} style={{ background: '#FF0000', border: 'none', borderRadius: 8, padding: '0 16px', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Load</button>
          </div>

          {/* Search Query */}
          <div style={{ display: 'flex', gap: 8, marginBottom: searchResults.length > 0 ? 10 : 0 }}>
            <input
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Or search YouTube..."
              style={{ flex: 1, background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
            />
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {searchResults.map(r => (
                <button
                  key={r.id}
                  onClick={() => loadVideo(r.id)}
                  style={{ display: 'flex', gap: 10, padding: '8px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                >
                  <img src={r.thumbnail} alt={r.title} style={{ width: 80, height: 45, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{r.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.channelName}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
