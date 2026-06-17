import React, { useState } from 'react';
import { updateGroupBotsDirect } from '../../lib/supabaseGroups';
import { useChatStore } from '../../store/chatStore';

export default function GroupSettingsModal({ group, onClose }) {
  const [activeTab, setActiveTab] = useState('invite'); // 'invite' | 'bots'
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedBotIds, setSelectedBotIds] = useState(group.bot_ids || []);
  const [saving, setSaving] = useState(false);

  const { bots, mediaBots, updateGroup } = useChatStore();
  const allBots = [...mediaBots, ...bots];

  const toggleBot = (id) => {
    setSelectedBotIds(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };

  const handleSaveBots = async () => {
    setSaving(true);
    try {
      await updateGroupBotsDirect(group.id, selectedBotIds);
      updateGroup(group.id, { bot_ids: selectedBotIds });
      onClose();
    } catch (err) {
      console.error('Failed to update bots:', err);
      alert('Failed to update bots');
    }
    setSaving(false);
  };

  const handleSendInvite = () => {
    if (!inviteEmail.trim()) return;
    const inviteLink = `https://botverse-mu.vercel.app/?join=${group.invite_code}`;
    const subject = encodeURIComponent(`Join my group "${group.name}" on BotVerse!`);
    const body = encodeURIComponent(`Hey! I created a group called "${group.name}" on BotVerse where we can chat with AI characters and watch YouTube together.\n\nClick this link to join instantly:\n${inviteLink}\n\nSee you there!`);
    
    window.location.href = `mailto:${inviteEmail}?subject=${subject}&body=${body}`;
    setInviteEmail('');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://botverse-mu.vercel.app/?join=${group.invite_code}`);
    alert('Invite link copied to clipboard!');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: 440, borderRadius: 20, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{group.emoji}</div>
            Group Settings
          </h2>
          <button onClick={onClose} style={{ background: 'var(--bg-overlay)', border: 'none', width: 32, height: 32, borderRadius: '50%', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
          <button onClick={() => setActiveTab('invite')} style={{ flex: 1, padding: '14px 0', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === 'invite' ? 'var(--accent)' : 'transparent'}`, color: activeTab === 'invite' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s' }}>
            Invite Members
          </button>
          <button onClick={() => setActiveTab('bots')} style={{ flex: 1, padding: '14px 0', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === 'bots' ? 'var(--accent)' : 'transparent'}`, color: activeTab === 'bots' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s' }}>
            Manage Bots
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          
          {activeTab === 'invite' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Invite via Email</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="email"
                    placeholder="friend@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    style={{ flex: 1, background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', color: 'var(--text-primary)', fontSize: 15, outline: 'none' }}
                  />
                  <button
                    onClick={handleSendInvite}
                    disabled={!inviteEmail}
                    style={{ background: inviteEmail ? 'var(--accent)' : 'var(--bg-overlay)', color: inviteEmail ? '#0a0b14' : 'var(--text-muted)', border: 'none', borderRadius: 10, padding: '0 20px', fontWeight: 600, cursor: inviteEmail ? 'pointer' : 'default', transition: 'all 0.2s' }}
                  >
                    Send
                  </button>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>This will open your default email client with a pre-filled invitation.</p>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Share Link Directly</label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', gap: 12 }}>
                  <div style={{ flex: 1, fontSize: 14, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    https://botverse-mu.vercel.app/?join={group.invite_code}
                  </div>
                  <button onClick={copyLink} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 12px', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Copy</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bots' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Select the bots you want active in this group.</p>
              
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                {allBots.map(bot => {
                  const isSelected = selectedBotIds.includes(bot.id);
                  return (
                    <div
                      key={bot.id}
                      onClick={() => toggleBot(bot.id)}
                      style={{
                        background: isSelected ? 'var(--bg-overlay)' : 'transparent',
                        border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                        borderRadius: 12, padding: '12px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 10,
                        transition: 'all 0.2s',
                        boxShadow: isSelected ? '0 0 0 1px var(--accent) inset' : 'none'
                      }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: bot.color ? `${bot.color}22` : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                        {bot.emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bot.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{bot.tag}</div>
                      </div>
                      {isSelected && <div style={{ color: 'var(--accent)', fontSize: 14 }}>✓</div>}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  onClick={handleSaveBots}
                  disabled={saving}
                  style={{ background: 'var(--accent)', color: '#0a0b14', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer' }}
                >
                  {saving ? 'Saving...' : 'Save Bots'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
