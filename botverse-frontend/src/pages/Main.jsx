import React, { useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import ChatList from '../components/chat/ChatList';
import GroupList from '../components/groups/GroupList';
import Marketplace from '../components/marketplace/Marketplace';
import CharacterChat from '../components/chat/CharacterChat';
import UtilityWorkspace from '../components/chat/UtilityWorkspace';
import YouTubeRoom from '../components/media/YouTubeRoom';
import SpotifyRoom from '../components/media/SpotifyRoom';
import ComingSoonRoom from '../components/media/ComingSoonRoom';
import GroupChat from '../components/groups/GroupChat';
import AgentBuilder from './AgentBuilder';
import CreateGroupModal from '../components/groups/CreateGroupModal';

export default function Main() {
  const [tab, setTab] = useState('chats');
  const [activeChat, setActiveChat] = useState(null); // { bot, group }
  const [showCreateBot, setShowCreateBot] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [search, setSearch] = useState('');

  const { user, signOut } = useAuthStore();
  const { bots, mediaBots, addBot, addGroup } = useChatStore();

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You';
  const avatarUrl = user?.user_metadata?.avatar_url;

  // Opens a chat/media room
  const openBot = (bot) => setActiveChat({ type: 'bot', bot });
  const openGroup = (group) => setActiveChat({ type: 'group', group });

  // ── Active screen routing ──
  if (activeChat) {
    const back = () => setActiveChat(null);

    if (activeChat.type === 'bot') {
      const { bot } = activeChat;
      if (bot.type === 'youtube') return <YouTubeRoom onBack={back} userId={user?.id} displayName={displayName} />;
      if (bot.type === 'spotify') return <SpotifyRoom onBack={back} userId={user?.id} displayName={displayName} />;
      if (bot.type === 'coming_soon') return <ComingSoonRoom bot={bot} onBack={back} />;

      // Redirect Utility / Study / Mom / Presentation bots to the Workspace UI
      if (bot.type === 'utility' || bot.type === 'study' || bot.type === 'presentation' || bot.type === 'mom' || (bot.tools && bot.tools.length > 0)) {
        return (
          <UtilityWorkspace
            bot={bot}
            onBack={back}
            userId={user?.id}
            displayName={displayName}
          />
        );
      }

      return (
        <CharacterChat
          bot={bot}
          onBack={back}
          userId={user?.id}
          displayName={displayName}
        />
      );
    }

    if (activeChat.type === 'group') {
      return (
        <GroupChat
          group={activeChat.group}
          onBack={back}
          userId={user?.id}
          displayName={displayName}
          avatarUrl={avatarUrl}
        />
      );
    }
  }

  // ── Main list view ──
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>

      {/* ── Top Header ── */}
      <div style={{
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '14px 16px 0',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* User avatar */}
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), #7b61ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: '#0a0b14',
              }}>
                {displayName[0]?.toUpperCase()}
              </div>
            )}
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: 'var(--text-primary)' }}>
              Bot<span style={{ color: 'var(--accent)' }}>Verse</span>
            </span>
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              id="create-bot-fab-header"
              onClick={() => setShowCreateBot(true)}
              style={{
                background: 'var(--accent)', border: 'none',
                borderRadius: 10, padding: '7px 14px',
                color: '#0a0b14', fontWeight: 700, fontSize: 13,
              }}
            >
              + New Bot
            </button>
            <button
              onClick={signOut}
              title="Sign out"
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                fontSize: 18, padding: '6px 8px', borderRadius: 8,
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              ↩
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{
          background: 'var(--bg-overlay)', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', marginBottom: 12,
          border: '1px solid transparent',
          transition: 'border-color 0.2s',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            id="search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search bots, groups..."
            style={{
              flex: 1, background: 'none', border: 'none',
              color: 'var(--text-primary)', fontSize: 15, outline: 'none',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex' }}>
          {[['chats', 'Chats'], ['groups', 'Groups'], ['explore', 'Explore']].map(([id, label]) => (
            <button
              key={id}
              id={`tab-${id}`}
              onClick={() => setTab(id)}
              style={{
                flex: 1, padding: '9px 0 11px', background: 'none', border: 'none',
                color: tab === id ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: tab === id ? 700 : 500,
                fontSize: 14, cursor: 'pointer',
                borderBottom: `2px solid ${tab === id ? 'var(--accent)' : 'transparent'}`,
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'chats' && (
          <ChatList
            bots={bots}
            mediaBots={mediaBots}
            search={search}
            onOpenBot={openBot}
          />
        )}

        {tab === 'groups' && (
          <GroupList
            search={search}
            onOpenGroup={openGroup}
            onCreateGroup={() => setShowCreateGroup(true)}
            userId={user?.id}
          />
        )}

        {tab === 'explore' && (
          <Marketplace
            search={search}
            onOpenBot={openBot}
            currentUserId={user?.id}
          />
        )}
      </div>

      {/* ── FAB ── */}
      <button
        id="create-bot-fab"
        onClick={() => setShowCreateBot(true)}
        style={{
          position: 'fixed', bottom: 24, right: 20,
          width: 56, height: 56, borderRadius: '50%',
          border: 'none', background: 'var(--accent)',
          color: '#0a0b14', fontSize: 26,
          boxShadow: '0 4px 24px var(--accent-glow)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s, box-shadow 0.2s',
          zIndex: 100,
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(90,200,250,0.4)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 24px var(--accent-glow)'; }}
      >
        ✏️
      </button>

      {/* ── Modals / Overlays ── */}
      {showCreateBot && (
        <AgentBuilder
          onClose={() => setShowCreateBot(false)}
          onCreated={(bot) => {
            setShowCreateBot(false);
            openBot(bot);
          }}
        />
      )}

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={group => { addGroup(group); setShowCreateGroup(false); }}
          userId={user?.id}
          bots={bots}
        />
      )}
    </div>
  );
}
