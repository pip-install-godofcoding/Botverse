import React from 'react';
import ChatRow from './ChatRow';

export default function ChatList({ bots, mediaBots, search, onOpenBot }) {
  const q = search.toLowerCase();

  const filteredMedia = mediaBots.filter(b => b.name.toLowerCase().includes(q));
  const utilityBots = bots.filter(b => ['study', 'presentation', 'mom', 'utility'].includes(b.type) && b.name.toLowerCase().includes(q));
  const characterBots = bots.filter(b => b.type === 'character' && b.name.toLowerCase().includes(q));

  const SectionHeader = ({ label }) => (
    <div style={{ padding: '10px 16px 4px' }}>
      <span style={{ color: 'var(--text-placeholder)', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
        {label}
      </span>
    </div>
  );

  return (
    <div>
      {filteredMedia.length > 0 && (
        <>
          <SectionHeader label="MEDIA ROOMS" />
          {filteredMedia.map(bot => <ChatRow key={bot.id} item={bot} onClick={onOpenBot} />)}
        </>
      )}

      {utilityBots.length > 0 && (
        <>
          <SectionHeader label="UTILITY BOTS" />
          {utilityBots.map(bot => <ChatRow key={bot.id} item={bot} onClick={onOpenBot} />)}
        </>
      )}

      {characterBots.length > 0 && (
        <>
          <SectionHeader label="CHARACTER BOTS" />
          {characterBots.map(bot => <ChatRow key={bot.id} item={bot} onClick={onOpenBot} />)}
        </>
      )}

      {filteredMedia.length === 0 && utilityBots.length === 0 && characterBots.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>No results</div>
          <div style={{ fontSize: 13 }}>Try a different search or create a new bot</div>
        </div>
      )}
    </div>
  );
}
