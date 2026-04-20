import React, { useEffect, useState } from 'react';
import { fetchBots } from '../../lib/api';
import { BotAvatar, BotTag } from '../bots/BotAvatar';

const ALL_TAGS = ['All', 'Anime', 'Bollywood', 'Hollywood', 'Science', 'Utility', 'History', 'Comedy', 'Sports', 'Custom'];

export default function Marketplace({ search, onOpenBot, currentUserId }) {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [sortBy, setSortBy] = useState('popular'); // 'popular' | 'recent'

  useEffect(() => {
    fetchBots({ public: 'true' })
      .then(({ bots: b }) => setBots(b || []))
      .catch(() => setBots([]))
      .finally(() => setLoading(false));
  }, []);

  const q = search.toLowerCase();
  const filtered = bots
    .filter(b =>
      (filter === 'All' || b.tag === filter) &&
      (b.name?.toLowerCase().includes(q) || b.tag?.toLowerCase().includes(q) || b.prompt?.toLowerCase().includes(q))
    )
    .sort((a, b) => {
      if (sortBy === 'popular') return (b.likes || 0) - (a.likes || 0);
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

  const copyShareLink = (bot) => {
    const link = `${window.location.origin}?bot=${bot.id}`;
    navigator.clipboard.writeText(link);
  };

  const handleLike = async (e, bot) => {
    e.stopPropagation();
    try {
      // Optimistic UI update
      setBots(prev => prev.map(b => b.id === bot.id ? { ...b, likes: (b.likes || 0) + 1} : b));
      // In a real app we'd import likeBot from api.js and call it:
      // await likeBot(bot.id);
      const { likeBot } = await import('../../lib/api');
      await likeBot(bot.id);
    } catch {
      // revert
      setBots(prev => prev.map(b => b.id === bot.id ? { ...b, likes: (b.likes || 0) - 1} : b));
    }
  };

  return (
    <div>
      {/* Filter chips & Sort */}
      <div style={{ padding: '10px 14px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0 }}>
          {ALL_TAGS.map(t => (
            <button
              key={t} onClick={() => setFilter(t)}
              style={{ padding: '5px 13px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0, background: filter === t ? 'var(--accent)' : 'var(--bg-overlay)', color: filter === t ? '#0a0b14' : 'var(--text-secondary)' }}
            >
              {t}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} 
          style={{ background: 'var(--bg-overlay)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', fontSize: 12, outline: 'none' }}>
          <option value="popular">🔥 Popular</option>
          <option value="recent">🕒 Recent</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌐</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>No bots found</div>
          <div style={{ fontSize: 13 }}>Create a bot and mark it as public to see it here!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map(bot => (
            <div
              key={bot.id}
              style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <BotAvatar bot={bot} size={50} showOnline />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15.5 }}>{bot.name}</span>
                    <BotTag type={bot.type} color={bot.color} />
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>#{bot.tag}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                  {bot.prompt?.slice(0, 70)}...
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>by {bot.creator_name || 'Anonymous'}</span>
                  <span>🔥 {bot.likes || 0}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={(e) => handleLike(e, bot)}
                  style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <span style={{ fontSize: 16 }}>🤍</span>
                </button>
                <button
                  onClick={() => onOpenBot(bot)}
                  style={{ background: bot.color || 'var(--accent)', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  Chat
                </button>
                <button
                  onClick={() => copyShareLink(bot)}
                  title="Copy share link"
                  style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                >
                  🔗 Share
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
