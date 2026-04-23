import React, { useState } from 'react';
import { createGroupDirect } from '../../lib/supabaseGroups';
import { useChatStore } from '../../store/chatStore';

const EMOJIS = ['💬', '🎌', '🎬', '💃', '🎮', '🏀', '🎵', '📚', '🌏', '🔥', '💫', '⚡'];

export default function CreateGroupModal({ onClose, onCreated, userId, bots, mediaBots = [] }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💬');
  const [selectedBots, setSelectedBots] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleBot = (bot) => {
    setSelectedBots(prev =>
      prev.find(b => b.id === bot.id)
        ? prev.filter(b => b.id !== bot.id)
        : [...prev, bot]
    );
  };

  const handleCreate = async () => {
    if (!name) return;
    
    // Prevent Demo users from crashing the backend UUID constraint
    if (!userId || userId.startsWith('demo-')) {
      setError('You must sign in with a real account to create groups!');
      return;
    }

    setSaving(true);
    try {
      const res = await createGroupDirect({
        name, emoji, creator_id: userId,
        bot_ids: selectedBots.map(b => b.id),
      });
      onCreated(res.group);
    } catch (err) {
      setError('Could not create group. Are you signed in?');
    }
    setSaving(false);
  };

  const charBots = bots.filter(b => b.type === 'character' || b.type === 'utility' || b.type === 'study' || b.type === 'presentation' || b.type === 'mom' || b.type === 'custom' || b.tag === 'Custom');
  const allBots = [...charBots, ...mediaBots.filter(b => b.type !== 'coming_soon')];

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg-overlay)' }} />
        </div>
        <div style={{ padding: '8px 20px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>💬 New Group</div>
            <button onClick={onClose} style={{ background: 'var(--bg-overlay)', border: 'none', color: 'var(--text-secondary)', borderRadius: '50%', width: 32, height: 32, fontSize: 15, cursor: 'pointer' }}>✕</button>
          </div>

          {/* Preview */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #2a2d45, #1a1d2e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
              {emoji}
            </div>
          </div>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Group name..."
            style={{ width: '100%', background: 'var(--bg-base)', border: 'none', borderBottom: `2px solid ${name ? 'var(--accent)' : 'var(--border)'}`, padding: '10px 2px', color: 'var(--text-primary)', fontSize: 16, outline: 'none', marginBottom: 22, transition: 'border-color 0.2s' }}
          />

          <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, marginBottom: 10 }}>EMOJI</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)} style={{ width: 40, height: 40, borderRadius: 10, fontSize: 20, background: emoji === e ? 'rgba(90,200,250,0.2)' : 'var(--bg-base)', border: `1.5px solid ${emoji === e ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer' }}>
                {e}
              </button>
            ))}
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, marginBottom: 10 }}>ADD BOTS (optional)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>

            {/* Chat Bots section */}
            {charBots.length > 0 && (
              <div style={{ color: 'var(--text-placeholder)', fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 4, marginTop: 4 }}>CHAT BOTS</div>
            )}
            {charBots.slice(0, 8).map(bot => {
              const selected = selectedBots.find(b => b.id === bot.id);
              return (
                <button key={bot.id} onClick={() => toggleBot(bot)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${selected ? bot.color : 'var(--border)'}`, background: selected ? `${bot.color}15` : 'var(--bg-base)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${bot.color}cc, ${bot.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{bot.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: selected ? bot.color : 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>{bot.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{bot.tag}</div>
                  </div>
                  {selected && <span style={{ color: bot.color, fontSize: 18 }}>✓</span>}
                </button>
              );
            })}

            {/* Media Rooms section */}
            {mediaBots.filter(b => b.type !== 'coming_soon').length > 0 && (
              <div style={{ color: 'var(--text-placeholder)', fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 4, marginTop: 10 }}>MEDIA ROOMS</div>
            )}
            {mediaBots.filter(b => b.type !== 'coming_soon').map(bot => {
              const selected = selectedBots.find(b => b.id === bot.id);
              return (
                <button key={bot.id} onClick={() => toggleBot(bot)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${selected ? bot.color : 'var(--border)'}`, background: selected ? `${bot.color}15` : 'var(--bg-base)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${bot.color}cc, ${bot.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{bot.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: selected ? bot.color : 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>{bot.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{bot.description || `#${bot.tag}`}</div>
                  </div>
                  {selected && <span style={{ color: bot.color, fontSize: 18 }}>✓</span>}
                </button>
              );
            })}
          </div>

          {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{error}</div>}

          <button
            onClick={handleCreate}
            disabled={!name || saving}
            style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: name && !saving ? 'var(--accent)' : 'var(--bg-overlay)', color: name && !saving ? '#0a0b14' : 'var(--text-muted)', fontWeight: 700, fontSize: 15, cursor: name && !saving ? 'pointer' : 'default' }}
          >
            {saving ? '⏳ Creating...' : '🚀 Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
