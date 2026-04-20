import React, { useEffect, useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { fetchGroups, joinGroup } from '../../lib/api';

export default function GroupList({ search, onOpenGroup, onCreateGroup, userId }) {
  const { groups, setGroups, addGroup } = useChatStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (!userId) {
      console.warn('[GroupList] No userId yet, skipping fetch');
      return;
    }
    console.log('[GroupList] Fetching groups for userId:', userId);
    setLoading(true);
    setError('');
    fetchGroups(userId)
      .then(({ groups: g }) => {
        console.log('[GroupList] Got groups:', g);
        setGroups(g || []);
      })
      .catch((err) => {
        console.error('[GroupList] Failed to fetch groups:', err);
        setError(err.message || 'Failed to load groups');
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const filtered = groups.filter(g => g.name?.toLowerCase().includes(search.toLowerCase()));

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError('');
    try {
      const { group } = await joinGroup(joinCode.trim().toUpperCase(), userId);
      addGroup(group);
      setJoinCode('');
      setShowJoin(false);
      onOpenGroup(group);
    } catch (err) {
      setJoinError('Invalid invite code or group not found.');
    }
    setJoining(false);
  };

  return (
    <div>
      {/* Join Group banner */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
        {!showJoin ? (
          <button
            onClick={() => setShowJoin(true)}
            style={{ flex: 1, background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 14px', color: 'var(--text-secondary)', fontSize: 13.5, cursor: 'pointer', textAlign: 'left', fontWeight: 500 }}
          >
            🔗 Join a group with invite code...
          </button>
        ) : (
          <div style={{ flex: 1, display: 'flex', gap: 8, flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                autoFocus
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="Enter invite code (e.g. BWRBY1PO)"
                style={{ flex: 1, background: 'var(--bg-overlay)', border: '1px solid var(--accent)', borderRadius: 10, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', letterSpacing: 1.5, fontWeight: 700 }}
              />
              <button onClick={handleJoin} disabled={joining || !joinCode.trim()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '9px 16px', color: '#0a0b14', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {joining ? '...' : 'Join'}
              </button>
              <button onClick={() => { setShowJoin(false); setJoinCode(''); setJoinError(''); }} style={{ background: 'var(--bg-overlay)', border: 'none', borderRadius: 10, padding: '9px 12px', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>✕</button>
            </div>
            {joinError && <div style={{ color: '#ff6b6b', fontSize: 12, paddingLeft: 4 }}>{joinError}</div>}
          </div>
        )}
      </div>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <>
          {filtered.map(g => (
            <div
              key={g.id}
              onClick={() => onOpenGroup(g)}
              style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'linear-gradient(135deg, #2a2d45, #1a1d2e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                {g.emoji || '💬'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15.5 }}>{g.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.time || ''}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                    {g.lastMsg || `Invite: ${g.invite_code}`}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Create group button */}
          <div
            onClick={onCreateGroup}
            style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--bg-overlay)', border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 22, flexShrink: 0 }}>
              +
            </div>
            <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 15.5 }}>New Group</div>
          </div>

          {error && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#ff6b6b', fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          {filtered.length === 0 && !loading && !error && (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>No groups yet</div>
              <div style={{ fontSize: 13 }}>Create a group and invite friends with bots!</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
