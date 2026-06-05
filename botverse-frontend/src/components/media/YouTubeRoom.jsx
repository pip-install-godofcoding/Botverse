import React, { useState, useRef, useEffect, useCallback } from 'react';
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

// ── Dynamically load the YouTube IFrame API script (once) ────────────────────
let ytApiLoaded = false;
let ytApiCallbacks = [];

function loadYTApi() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    if (ytApiLoaded) {
      ytApiCallbacks.push(resolve);
      return;
    }
    ytApiLoaded = true;
    ytApiCallbacks.push(resolve);

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      ytApiCallbacks.forEach(cb => cb());
      ytApiCallbacks = [];
    };

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
}

export default function YouTubeRoom({ groupId, userId, displayName, onClose, onBack }) {
  const handleClose = onClose || onBack || (() => {});
  const [videoId, setVideoId] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [members, setMembers] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);

  const playerRef = useRef(null);       // YT.Player instance
  const playerContainerRef = useRef(null); // DOM div for the player
  const searchTimeout = useRef(null);
  const isSyncingRef = useRef(false);   // Prevents feedback loops
  const currentVideoRef = useRef(null); // Track loaded video to avoid re-creating player

  const roomId = groupId || 'global';

  // ── Create or cue a video on the YT Player ──────────────────────────────────
  const createOrLoadPlayer = useCallback((vid) => {
    if (!vid) return;
    currentVideoRef.current = vid;

    // If player already exists, just cue the new video
    if (playerRef.current && playerRef.current.loadVideoById) {
      isSyncingRef.current = true;
      playerRef.current.loadVideoById(vid);
      setTimeout(() => { isSyncingRef.current = false; }, 500);
      return;
    }

    // Otherwise create a fresh player
    loadYTApi().then(() => {
      if (!playerContainerRef.current) return;

      playerRef.current = new window.YT.Player(playerContainerRef.current, {
        videoId: vid,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            console.log('[YT] Player ready');
          },
          onStateChange: (event) => {
            // Don't re-broadcast events that came from the server
            if (isSyncingRef.current) return;

            const state = event.data;
            const time = playerRef.current?.getCurrentTime?.() || 0;

            if (state === window.YT.PlayerState.PLAYING) {
              socket.emit('play', { roomId, currentTime: time });
            } else if (state === window.YT.PlayerState.PAUSED) {
              socket.emit('pause', { roomId, currentTime: time });
            }
          },
        },
      });
    });
  }, [roomId]);

  // ── Join watch room & wire up socket events ─────────────────────────────────
  useEffect(() => {
    socket.emit('join-watch', { roomId, userId, displayName });

    // Initial room state (when joining an existing room with a video playing)
    socket.on('room-state', (state) => {
      setIsHost(state.isHost);
      setMembers(state.members || []);
      if (state.videoId) {
        setVideoId(state.videoId);
        // Delay player creation slightly to let the DOM render
        setTimeout(() => {
          createOrLoadPlayer(state.videoId);
          // If video is already playing in the room, seek to the current time
          if (state.playing && state.currentTime) {
            setTimeout(() => {
              if (playerRef.current?.seekTo) {
                isSyncingRef.current = true;
                playerRef.current.seekTo(state.currentTime, true);
                playerRef.current.playVideo();
                setTimeout(() => { isSyncingRef.current = false; }, 500);
              }
            }, 1500); // Wait for player to be ready
          }
        }, 100);
      }
    });

    // Someone loaded a new video
    socket.on('video-loaded', ({ videoId: vid, loadedBy }) => {
      console.log(`[YT] ${loadedBy} loaded video ${vid}`);
      setVideoId(vid);
      createOrLoadPlayer(vid);
    });

    // Sync play from another user
    socket.on('video-play', ({ currentTime }) => {
      if (playerRef.current?.playVideo) {
        isSyncingRef.current = true;
        playerRef.current.seekTo(currentTime, true);
        playerRef.current.playVideo();
        setTimeout(() => { isSyncingRef.current = false; }, 500);
      }
    });

    // Sync pause from another user
    socket.on('video-pause', ({ currentTime }) => {
      if (playerRef.current?.pauseVideo) {
        isSyncingRef.current = true;
        playerRef.current.seekTo(currentTime, true);
        playerRef.current.pauseVideo();
        setTimeout(() => { isSyncingRef.current = false; }, 500);
      }
    });

    // Sync seek from another user
    socket.on('video-seek', ({ seekTo }) => {
      if (playerRef.current?.seekTo) {
        isSyncingRef.current = true;
        playerRef.current.seekTo(seekTo, true);
        setTimeout(() => { isSyncingRef.current = false; }, 500);
      }
    });

    // Host promotion
    socket.on('you-are-host', () => setIsHost(true));

    // Member updates
    socket.on('user-joined', ({ displayName: name, members: m }) => {
      setMembers(m);
    });
    socket.on('user-left', ({ displayName: name, members: m }) => {
      setMembers(m);
    });

    // Watch chat
    socket.on('watch-chat', (msg) => {
      setChatMessages(prev => [...prev.slice(-100), msg]); // Keep last 100
    });

    return () => {
      socket.emit('leave-watch', { roomId });
      socket.off('room-state');
      socket.off('video-loaded');
      socket.off('video-play');
      socket.off('video-pause');
      socket.off('video-seek');
      socket.off('you-are-host');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('watch-chat');
      // Destroy player
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [roomId, userId, displayName, createOrLoadPlayer]);

  // ── YouTube search with debounce ────────────────────────────────────────────
  const handleSearchChange = (q) => {
    setSearchQuery(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { results } = await searchYouTube(q);
        setSearchResults(results || []);
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
    createOrLoadPlayer(id);
    socket.emit('video-load', { roomId, videoId: id });
  };

  const handleUrlLoad = () => {
    const id = extractYouTubeId(urlInput);
    if (id) {
      loadVideo(id);
      setUrlInput('');
    }
  };

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    socket.emit('watch-chat', { roomId, userId, displayName, text });
    setChatInput('');
  };

  const isStandalone = !groupId; // When opened from Chats tab (not inside a group)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', background: '#0a0b0f', borderBottom: '1px solid var(--border-subtle)', ...(isStandalone ? { height: '100vh' } : {}) }}>
      {/* Standalone header with back button */}
      {isStandalone && (
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 28, lineHeight: 1, cursor: 'pointer' }}>‹</button>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #FF000033, #FF000011)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>▶️</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15.5 }}>Watch Together</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{members.length > 0 ? `${members.length} watching` : 'YouTube sync room'}</div>
          </div>
        </div>
      )}
      {/* Video Area */}
      <div style={{ position: 'relative', width: '100%', background: '#000', flex: isStandalone ? 1 : 'none', aspectRatio: isStandalone ? 'auto' : '16/9', display: 'flex', flexDirection: 'column' }}>
        {/* Controls Overlay */}
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {/* Members badge */}
          <div style={{
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
            padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: '#fff',
          }}>
            <span style={{ color: '#5ac8fa', fontWeight: 700 }}>👥 {members.length}</span>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>watching</span>
            {isHost && <span style={{ background: '#FF6B35', borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>HOST</span>}
          </div>

          {/* Right buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowChat(!showChat)} style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
              💬 Chat
            </button>
            <button onClick={() => setShowSearch(!showSearch)} style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
              🔍 Search
            </button>
            <button onClick={handleClose} style={{ background: 'rgba(255,0,0,0.6)', border: 'none', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
              ✕ Close
            </button>
          </div>
        </div>

        {videoId ? (
          <div ref={playerContainerRef} style={{ width: '100%', flex: 1, minHeight: 0 }} />
        ) : (
          <div style={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 52, marginBottom: 12, filter: 'drop-shadow(0 0 20px rgba(255,0,0,0.4))' }}>▶️</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 4 }}>Watch Together</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Search or paste a YouTube link to start watching with friends</div>
          </div>
        )}
      </div>

      {/* Live Chat Panel (slides in from right conceptually, shown below video) */}
      {showChat && (
        <div style={{ background: '#111218', borderBottom: '1px solid #1a1a25', maxHeight: 220, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {chatMessages.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 16 }}>No messages yet. Say hi! 👋</div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: msg.userId === userId ? '#5ac8fa' : '#FF6B35', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {msg.displayName}:
                </span>
                <span style={{ color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.4 }}>{msg.text}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 'auto', flexShrink: 0 }}>{msg.time}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderTop: '1px solid #1a1a25' }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Type a message..."
              style={{ flex: 1, background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
            />
            <button onClick={sendChat} style={{ background: '#5ac8fa', border: 'none', borderRadius: 8, padding: '0 16px', color: '#0a0b14', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Send</button>
          </div>
        </div>
      )}

      {/* Search Panel */}
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
