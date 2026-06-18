import React, { useState, useRef, useEffect } from 'react';
import { socket } from '../../lib/socket';
import { searchYouTube } from '../../lib/api';

export default function SpotifyRoom({ groupId, userId, displayName, onClose }) {
  const [trackId, setTrackId] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  const [isHost, setIsHost] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [members, setMembers] = useState([]);
  
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const searchTimeout = useRef(null);
  const isSyncingRef = useRef(false);
  const currentVideoRef = useRef(null);
  const lastTimeRef = useRef();
  const lastTickRef = useRef(Date.now());

  const roomId = groupId || 'global';

  // ── YouTube IFrame Setup ────────────────────────────────────────────────────
  const createOrLoadPlayer = (id) => {
    if (currentVideoRef.current === id && playerRef.current) return;
    currentVideoRef.current = id;

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = () => initPlayer(id);
    } else {
      initPlayer(id);
    }
  };

  const initPlayer = (id) => {
    if (!playerContainerRef.current) return;
    if (playerRef.current?.destroy) playerRef.current.destroy();

    playerRef.current = new window.YT.Player(playerContainerRef.current, {
      videoId: id,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onReady: (event) => {
          setDuration(event.target.getDuration());
          event.target.playVideo();
        },
        onStateChange: (event) => {
          if (isSyncingRef.current) return;
          const state = event.data;
          const time = playerRef.current?.getCurrentTime?.() || 0;
          
          if (state === window.YT.PlayerState.PLAYING) {
            setPlaying(true);
            socket.emit('play', { roomId, currentTime: time });
          } else if (state === window.YT.PlayerState.PAUSED) {
            setPlaying(false);
            socket.emit('pause', { roomId, currentTime: time });
          }
        },
      },
    });
  };

  // ── Socket Syncing ──────────────────────────────────────────────────────────
  useEffect(() => {
    socket.emit('join-listen', { roomId, userId, displayName });

    socket.on('listen-room-state', (state) => {
      setIsHost(state.isHost);
      setIsLocked(state.isLocked || false);
      setMembers(state.members || []);
      if (state.track) {
        setTrackId(state.track.trackId);
        setCurrentTrack(state.track);
        setTimeout(() => {
          createOrLoadPlayer(state.track.trackId);
          if (state.playing && state.currentTime) {
            setTimeout(() => {
              if (playerRef.current?.seekTo) {
                isSyncingRef.current = true;
                playerRef.current.seekTo(state.currentTime, true);
                playerRef.current.playVideo();
                setTimeout(() => { isSyncingRef.current = false; }, 500);
              }
            }, 1500);
          }
        }, 100);
      }
    });

    socket.on('listen-lock-updated', ({ isLocked: locked }) => {
      setIsLocked(locked);
    });

    socket.on('listen-host-heartbeat', ({ currentTime: hostTime, playing: hostPlaying }) => {
      if (!isLocked) return;
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const myTime = playerRef.current.getCurrentTime();
        const myState = playerRef.current.getPlayerState();
        
        const outOfSync = Math.abs(myTime - hostTime) > 2;
        const wrongState = (hostPlaying && myState !== window.YT.PlayerState.PLAYING) || (!hostPlaying && myState === window.YT.PlayerState.PLAYING);
        
        if (outOfSync || wrongState) {
          isSyncingRef.current = true;
          if (outOfSync) playerRef.current.seekTo(hostTime, true);
          if (hostPlaying) {
            playerRef.current.playVideo();
            setPlaying(true);
          } else {
            playerRef.current.pauseVideo();
            setPlaying(false);
          }
          setTimeout(() => { isSyncingRef.current = false; }, 500);
        }
      }
    });

    socket.on('track-loaded', ({ track, loadedBy }) => {
      setTrackId(track.trackId);
      setCurrentTrack(track);
      setTimeout(() => createOrLoadPlayer(track.trackId), 50);
    });

    socket.on('listen-play', ({ currentTime: time }) => {
      if (playerRef.current?.playVideo) {
        isSyncingRef.current = true;
        playerRef.current.seekTo(time, true);
        playerRef.current.playVideo();
        setPlaying(true);
        setTimeout(() => { isSyncingRef.current = false; }, 500);
      }
    });

    socket.on('listen-pause', ({ currentTime: time }) => {
      if (playerRef.current?.pauseVideo) {
        isSyncingRef.current = true;
        playerRef.current.seekTo(time, true);
        playerRef.current.pauseVideo();
        setPlaying(false);
        setTimeout(() => { isSyncingRef.current = false; }, 500);
      }
    });

    socket.on('listen-seek', ({ seekTo }) => {
      if (playerRef.current?.seekTo) {
        isSyncingRef.current = true;
        playerRef.current.seekTo(seekTo, true);
        setTimeout(() => { isSyncingRef.current = false; }, 500);
      }
    });

    socket.on('you-are-listen-host', () => setIsHost(true));
    socket.on('user-joined', ({ members: m }) => setMembers(m));
    socket.on('user-left', ({ members: m }) => setMembers(m));

    return () => {
      socket.emit('leave-listen', { roomId });
      socket.off('listen-room-state');
      socket.off('listen-lock-updated');
      socket.off('listen-host-heartbeat');
      socket.off('track-loaded');
      socket.off('listen-play');
      socket.off('listen-pause');
      socket.off('listen-seek');
      socket.off('you-are-listen-host');
      socket.off('user-joined');
      socket.off('user-left');
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [roomId, userId, displayName, isLocked]);

  // ── Seek Detection & Heartbeat Polling ──────────────────────────────────────
  useEffect(() => {
    if (!trackId) return;
    const interval = setInterval(() => {
      if (!playerRef.current || !playerRef.current.getCurrentTime) return;
      
      const time = playerRef.current.getCurrentTime();
      setCurrentTime(time);
      if (playerRef.current.getDuration) setDuration(playerRef.current.getDuration());

      const isPlay = playerRef.current.getPlayerState() === window.YT.PlayerState.PLAYING;
      setPlaying(isPlay);
      
      // Detect Seeks (Local jump > 1.5s not caused by normal playback)
      if (lastTimeRef.current !== undefined) {
         const expectedDiff = isPlay ? (Date.now() - lastTickRef.current) / 1000 : 0;
         const actualDiff = time - lastTimeRef.current;
         
         if (!isSyncingRef.current && Math.abs(actualDiff - expectedDiff) > 1.5) {
           socket.emit('seek', { roomId, seekTo: time });
         }
      }
      lastTimeRef.current = time;
      lastTickRef.current = Date.now();

      // Host Heartbeat
      if (isHost) {
        socket.emit('sync-heartbeat', { roomId, currentTime: time, playing: isPlay });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [trackId, isHost, roomId]);

  // ── UI Handlers ────────────────────────────────────────────────────────────
  const handleSearchChange = (q) => {
    setSearchQuery(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { results } = await searchYouTube(q + ' audio track');
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 600);
  };

  const loadTrack = (result) => {
    socket.emit('track-load', {
      roomId,
      trackId: result.id,
      trackTitle: result.title,
      trackArtist: result.channelName,
      trackThumbnail: result.thumbnail,
    });
    setShowSearch(false);
    setSearchResults([]);
    setSearchQuery('');
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (playing) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(time, true);
    }
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#050e07', borderBottom: '1px solid var(--border-subtle)', position: 'relative' }}>
      
      {/* Hidden YouTube Player */}
      <div style={{ position: 'absolute', opacity: 0.01, pointerEvents: 'none', width: 10, height: 10, overflow: 'hidden' }}>
        <div ref={playerContainerRef}></div>
      </div>

      {/* Controls Overlay */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        <div className="overlay-members" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff' }}>
          <span style={{ color: '#fa243c', fontWeight: 700 }}>🎵 Listen Together</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          {members.length} listening
          {isHost && <span style={{ background: '#fa243c', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, marginLeft: 4 }}>HOST</span>}
        </div>

        <div className="overlay-buttons" style={{ display: 'flex', gap: 6 }}>
          {isHost && (
            <button onClick={() => socket.emit('toggle-lock', { roomId, locked: !isLocked })} style={{ background: isLocked ? 'rgba(250,36,60,0.8)' : 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
              {isLocked ? '🔒 Locked' : '🔓 Unlocked'}
            </button>
          )}
          {!(isLocked && !isHost) && (
            <button onClick={() => setShowSearch(!showSearch)} style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
              🔍 Search
            </button>
          )}
          <button onClick={onClose} style={{ background: 'rgba(250,36,60,0.6)', border: 'none', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
            ✕ Close
          </button>
        </div>
      </div>

      {/* Main Music UI */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px 20px', background: 'radial-gradient(circle at center, #1a2e1d 0%, #050e07 100%)' }}>
        {currentTrack ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 400 }}>
            <img src={currentTrack.trackThumbnail} alt={currentTrack.trackTitle} style={{ width: 200, height: 200, borderRadius: 20, objectFit: 'cover', boxShadow: '0 12px 30px rgba(0,0,0,0.5)', marginBottom: 24, animation: playing ? 'pulse 2s infinite' : 'none' }} />
            
            <div style={{ textAlign: 'center', marginBottom: 24, width: '100%' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.trackTitle}</div>
              <div style={{ fontSize: 14, color: '#fa243c', marginTop: 4 }}>{currentTrack.trackArtist}</div>
            </div>

            {/* Scrubber */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatTime(currentTime)}</span>
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={currentTime} 
                onChange={handleSeek}
                style={{ flex: 1, accentColor: '#fa243c', height: 4, cursor: 'pointer' }} 
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatTime(duration)}</span>
            </div>

            {/* Playback Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <button onClick={() => { if (playerRef.current?.seekTo) playerRef.current.seekTo(Math.max(0, currentTime - 10), true); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>
              </button>
              
              <button onClick={togglePlay} style={{ width: 56, height: 56, borderRadius: '50%', background: '#fa243c', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(250,36,60,0.3)' }}>
                {playing ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 4 }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                )}
              </button>

              <button onClick={() => { if (playerRef.current?.seekTo) playerRef.current.seekTo(Math.min(duration, currentTime + 10), true); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#4a2a2d', gap: 16 }}>
            <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#0f1f12', border: '2px dashed #1a2e1d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>🎵</div>
            <div style={{ fontSize: 14 }}>Search for a song to start listening together</div>
          </div>
        )}
      </div>

      {/* Search panel */}
      {showSearch && !(isLocked && !isHost) && (
        <div style={{ background: '#0a1a0d', padding: '10px 14px', borderTop: '1px solid #0f2212' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: searchResults.length > 0 ? 10 : 0 }}>
            <input value={searchQuery} onChange={e => handleSearchChange(e.target.value)} placeholder={`Search for songs...`} autoFocus
              style={{ flex: 1, background: '#0f1f12', border: '1px solid #1a2e1d', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
            {searching && <div style={{ width: 28, height: 28, border: '2px solid #1a2e1d', borderTopColor: '#fa243c', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0, alignSelf: 'center' }} />}
          </div>

          {/* Results */}
          {searchResults.length > 0 && (
            <div className="scroll-y" style={{ maxHeight: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {searchResults.map(r => (
                <button key={r.id} onClick={() => loadTrack(r)}
                  style={{ display: 'flex', gap: 10, padding: '8px', background: '#0f1f12', border: '1px solid #1a2e1d', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
                >
                  {r.thumbnail && <img src={r.thumbnail} alt={r.title} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    <div style={{ color: '#fa243c', fontSize: 11 }}>{r.channelName}</div>
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
