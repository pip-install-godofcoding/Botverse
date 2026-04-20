import React, { useEffect, useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { fetchGroups } from '../../lib/api';

export default function GroupList({ search, onOpenGroup, onCreateGroup, userId }) {
  const { groups, setGroups } = useChatStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetchGroups(userId)
      .then(({ groups: g }) => setGroups(g || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const filtered = groups.filter(g => g.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
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

          {filtered.length === 0 && !loading && (
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
