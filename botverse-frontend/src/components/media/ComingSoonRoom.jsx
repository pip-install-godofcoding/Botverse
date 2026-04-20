import React from 'react';
import { BotAvatar } from '../bots/BotAvatar';

export default function ComingSoonRoom({ bot, onBack }) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>
      <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: bot.color, fontSize: 28, lineHeight: 1 }}>‹</button>
        <BotAvatar bot={bot} size={36} />
        <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15 }}>{bot.name}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 80, marginBottom: 24, animation: 'float 3s ease-in-out infinite' }}>{bot.emoji}</div>
        <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 22, marginBottom: 10 }}>{bot.name}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7, maxWidth: 300, marginBottom: 32 }}>{bot.description}</div>
        <div style={{ background: `${bot.color}15`, border: `1px solid ${bot.color}33`, borderRadius: 14, padding: '16px 22px', maxWidth: 320 }}>
          <div style={{ color: bot.color, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Why not yet?</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
            Netflix & Hotstar use DRM encryption that prevents browser embedding. A browser extension (like Teleparty) or native app is needed to sync playback.
          </div>
        </div>
      </div>
    </div>
  );
}
