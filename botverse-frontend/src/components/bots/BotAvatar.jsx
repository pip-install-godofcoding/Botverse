import React from 'react';

export function BotAvatar({ bot, size = 46, showOnline = false }) {
  const isMedia = ['youtube', 'spotify', 'coming_soon'].includes(bot?.type);
  const isGroup = bot?.members !== undefined || bot?.emoji_type === 'group';

  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: isGroup
          ? 'linear-gradient(135deg, #2a2d45, #1a1d2e)'
          : `linear-gradient(135deg, ${bot?.color || '#5ac8fa'}cc, ${bot?.color || '#5ac8fa'}33)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.44,
        boxShadow: `0 2px 12px ${bot?.color || '#5ac8fa'}22`,
      }}>
        {bot?.emoji || '🤖'}
      </div>
      {showOnline && (
        <div style={{
          position: 'absolute', bottom: 2, right: 1,
          width: Math.max(10, size * 0.22), height: Math.max(10, size * 0.22),
          borderRadius: '50%',
          background: 'var(--green)',
          border: '2px solid var(--bg-surface)',
        }} />
      )}
    </div>
  );
}

// Tag pill for bot type
export function BotTag({ type, color }) {
  const tags = {
    youtube: { label: 'LIVE', bg: '#FF000022', color: '#FF4444' },
    spotify: { label: 'SYNC', bg: '#1DB95422', color: '#1DB954' },
    coming_soon: { label: 'SOON', bg: '#2a2d3e', color: '#5a5a7a' },
    character: { label: 'AI', bg: color ? `${color}22` : '#5ac8fa22', color: color || '#5ac8fa' },
    study: { label: 'STUDY', bg: '#f59e0b22', color: '#f59e0b' },
    presentation: { label: 'PPT', bg: '#8b5cf622', color: '#8b5cf6' },
    mom: { label: 'MoM', bg: '#ec489922', color: '#ec4899' },
    utility: { label: 'TOOL', bg: '#22c55e22', color: '#22c55e' },
  };
  const t = tags[type] || tags.character;
  return (
    <span style={{
      background: t.bg, color: t.color,
      fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
      letterSpacing: 0.5, flexShrink: 0,
    }}>
      {t.label}
    </span>
  );
}
