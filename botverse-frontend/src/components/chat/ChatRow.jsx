import React, { useState } from 'react';
import { BotAvatar, BotTag } from '../bots/BotAvatar';

export default function ChatRow({ item, onClick }) {
  const [pressed, setPressed] = useState(false);
  const isComingSoon = item.type === 'coming_soon';
  const showOnline = !isComingSoon && item.type !== 'youtube' && item.type !== 'coming_soon';

  return (
    <div
      id={`chat-row-${item.id}`}
      onClick={() => onClick(item)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 13,
        padding: '11px 16px',
        background: pressed ? 'var(--bg-overlay)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.1s',
        borderBottom: '1px solid var(--border-subtle)',
        opacity: isComingSoon ? 0.55 : 1,
      }}
    >
      <BotAvatar bot={item} size={50} showOnline={showOnline} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15.5, truncate: true }}>
              {item.name}
            </span>
            <BotTag type={item.type} color={item.color} />
          </div>
          <span style={{ fontSize: 12, color: item.unread > 0 ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
            {item.time}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
            {item.lastMsg}
          </span>
          {item.unread > 0 && (
            <div style={{
              background: 'var(--accent)', color: '#0a0b14',
              borderRadius: 10, minWidth: 20, height: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, padding: '0 5px', flexShrink: 0,
            }}>
              {item.unread}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
