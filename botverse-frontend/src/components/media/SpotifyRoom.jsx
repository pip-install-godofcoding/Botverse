import React, { useState, useRef, useEffect } from 'react';
import { socket } from '../../lib/socket';
import { searchSpotify } from '../../lib/api';

function extractMusicEmbed(url) {
  if (url.includes('embed.music.apple.com')) return url;
  if (url.includes('music.apple.com')) {
    return url.replace('music.apple.com', 'embed.music.apple.com');
  }
  return null;
}

const SEARCH_TYPES = ['track', 'album', 'playlist'];

export default function SpotifyRoom({ groupId, userId, displayName, onClose }) {
  const [embedUrl, setEmbedUrl] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchType, setSearchType] = useState('track');
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const searchTimeout = useRef(null);

  // Join room
  useEffect(() => {
    socket.emit('join-listen', { roomId: groupId, userId, displayName });

    socket.on('listen-room-state', (state) => {
      if (state.currentTrack) {
        setEmbedUrl(state.currentTrack.embedUrl);
        setCurrentTrack(state.currentTrack);
      }
    });

    socket.on('track-loaded', ({ embedUrl, trackName, artistName }) => {
      setEmbedUrl(embedUrl);
      setCurrentTrack({ trackName, artistName });
    });

    return () => {
      socket.emit('leave-listen', { roomId: groupId });
      socket.off('listen-room-state');
      socket.off('track-loaded');
    };
  }, [groupId, userId, displayName]);

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
      roomId: groupId,
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
      socket.emit('track-load', { roomId: groupId, embedUrl: embed, trackName: 'Custom track', artistName: '' });
      setUrlInput('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', background: '#050e07', borderBottom: '1px solid var(--border-subtle)' }}>
      {/* Controls Overlay */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#0a1a0d' }}>
        <div style={{ color: '#fa243c', fontSize: 13, fontWeight: 700 }}>🎵 Listen Together</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowSearch(!showSearch)} style={{ background: '#0f1f12', border: '1px solid #1a2e1d', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 13, cursor: 'pointer' }}>
            🔍 Search
          </button>
          <button onClick={onClose} style={{ background: 'rgba(250,36,60,0.2)', border: 'none', color: '#fa243c', borderRadius: 8, padding: '4px 10px', fontSize: 13, cursor: 'pointer' }}>
            ✕ Close
          </button>
        </div>
      </div>

      {/* Apple Music embed player */}
      <div style={{ padding: '10px 14px', flexShrink: 0, position: 'relative' }}>
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
            <div style={{ fontSize: 13 }}>Search or paste a link above</div>
          </div>
        )}
      </div>

      {/* Search panel */}
      {showSearch && (
        <div style={{ background: '#0a1a0d', padding: '10px 14px', borderTop: '1px solid #0f2212' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadFromUrl()} placeholder="Paste Apple Music link..."
              style={{ flex: 1, background: '#0f1f12', border: '1px solid #1a2e1d', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
            <button onClick={loadFromUrl} style={{ background: '#fa243c', border: 'none', borderRadius: 8, padding: '0 16px', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Play</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: searchResults.length > 0 ? 10 : 0 }}>
            <input value={searchQuery} onChange={e => handleSearchChange(e.target.value)} placeholder={`Search tracks...`} autoFocus
              style={{ flex: 1, background: '#0f1f12', border: '1px solid #1a2e1d', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
            {searching && <div style={{ width: 28, height: 28, border: '2px solid #1a2e1d', borderTopColor: '#fa243c', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0, alignSelf: 'center' }} />}
          </div>

          {/* Results */}
          {searchResults.length > 0 && (
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {searchResults.map(r => (
                <button key={r.id} onClick={() => loadTrack(r)}
                  style={{ display: 'flex', gap: 10, padding: '8px', background: '#0f1f12', border: '1px solid #1a2e1d', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                >
                  {r.albumArt && <img src={r.albumArt} alt={r.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    <div style={{ color: '#fa243c', fontSize: 11 }}>{r.artists || r.owner}</div>
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
