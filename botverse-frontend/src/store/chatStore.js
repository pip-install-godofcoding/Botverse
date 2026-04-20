import { create } from 'zustand';
import { fetchBots, createBot as apiCreateBot, deleteBot as apiDeleteBot } from '../lib/api';

// Built-in bots (always present)
const BUILTIN_BOTS = [
  {
    id: 'gojo', name: 'Gojo Satoru', emoji: '🥷', color: '#6C63FF', type: 'character',
    prompt: 'You are Gojo Satoru from Jujutsu Kaisen. Extremely confident, playful, always refers to himself as the strongest. Uses "throughout heaven and earth, I alone am the honoured one" energy. Loves to tease and mock enemies and friends alike.',
    creator_name: 'BotVerse', tag: 'Anime', is_public: true, is_builtin: true,
    lastMsg: 'Throughout heaven and earth, I alone am— 😏', time: '9:41', unread: 2,
  },
  {
    id: 'srk', name: 'Shah Rukh Khan', emoji: '🌟', color: '#FF6B35', type: 'character',
    prompt: 'You are Shah Rukh Khan, King of Bollywood. Charming, witty, romantic, always ready with a filmy dialogue. References iconic movies and poses. Very loving towards fans. Speaks with Bollywood flair.',
    creator_name: 'BotVerse', tag: 'Bollywood', is_public: true, is_builtin: true,
    lastMsg: 'Tujhe pata hai main kaun hoon? 🎬', time: 'Yesterday', unread: 0,
  },
  {
    id: 'einstein', name: 'Albert Einstein', emoji: '🧠', color: '#00C9A7', type: 'character',
    prompt: 'You are Albert Einstein. Curious, humble yet brilliant. You explain complex physics in simple ways, make jokes about relativity and time, and always encourage scientific thinking and curiosity.',
    creator_name: 'BotVerse', tag: 'Science', is_public: true, is_builtin: true,
    lastMsg: 'Time is relative, my friend 😄', time: 'Mon', unread: 0,
  },
  {
    id: 'study-buddy', name: 'Study Buddy', emoji: '📚', color: '#f59e0b', type: 'study',
    prompt: 'You are Study Buddy, an expert educational assistant. You use the Feynman technique to explain concepts, break down complex ideas into simple parts, quiz the user to reinforce learning, and encourage curiosity.',
    creator_name: 'BotVerse', tag: 'Utility', is_public: true, is_builtin: true,
    lastMsg: 'What are we learning today? 📖', time: '2:30', unread: 0,
  },
  {
    id: 'ppt-bot', name: 'Presentation Builder', emoji: '🎯', color: '#8b5cf6', type: 'presentation',
    prompt: 'You are Presentation Builder Bot. An expert at creating structured, compelling slide presentations. You create full slide outlines with talking points, speaker notes, and strong visual storytelling.',
    creator_name: 'BotVerse', tag: 'Utility', is_public: true, is_builtin: true,
    lastMsg: 'Give me a topic and I\'ll build your deck 🎯', time: '11:00', unread: 0,
  },
  {
    id: 'mom-bot', name: 'MoM Writer', emoji: '📝', color: '#ec4899', type: 'mom',
    prompt: 'You are a professional Meeting Minutes (MoM) Writer. You transform raw notes, bullet points, and meeting summaries into formal, structured meeting minutes with Date, Attendees, Agenda, Decisions, and Action Items.',
    creator_name: 'BotVerse', tag: 'Utility', is_public: true, is_builtin: true,
    lastMsg: 'Paste your meeting notes and I\'ll write the MoM 📝', time: '9:00', unread: 0,
  },
];

const MEDIA_BOTS = [
  {
    id: 'watch-yt', name: 'Watch Together', emoji: '▶️', color: '#FF0000', type: 'youtube',
    tag: 'YouTube', lastMsg: 'Paste or search YouTube to watch together!', time: 'Now', unread: 0,
    description: 'Watch any YouTube video in sync with your friends.',
    is_builtin: true,
  },
  {
    id: 'listen', name: 'Listen Together', emoji: '🎵', color: '#1DB954', type: 'spotify',
    tag: 'Music', lastMsg: 'Search or paste Spotify to vibe together!', time: 'Now', unread: 0,
    description: 'Listen to Spotify tracks, albums or playlists together in sync.',
    is_builtin: true,
  },
  {
    id: 'watch-netflix', name: 'Netflix Together', emoji: '🎬', color: '#E50914', type: 'coming_soon',
    tag: 'Netflix', lastMsg: 'Coming soon — needs browser extension', time: 'Soon', unread: 0,
    description: 'Watch Netflix with friends. Requires a browser extension — coming soon!',
    is_builtin: true,
  },
];

export const useChatStore = create((set, get) => ({
  bots: BUILTIN_BOTS,
  mediaBots: MEDIA_BOTS,
  userBots: [],       // bots created by this user
  publicBots: [],     // bots from other users (marketplace)
  groups: [],
  loading: false,

  // Merge server bots with builtins
  loadUserBots: async (userId) => {
    if (!userId) return;
    try {
      const { bots } = await fetchBots({ creator_id: userId });
      set({ userBots: bots });
      // Merge user bots into the main bots list (avoid duplicates)
      set(state => ({
        bots: [
          ...BUILTIN_BOTS,
          ...bots.filter(b => !BUILTIN_BOTS.find(bb => bb.id === b.id)),
        ],
      }));
    } catch (err) {
      console.error('Failed to load user bots:', err);
    }
  },

  loadPublicBots: async () => {
    try {
      const { bots } = await fetchBots({ public: 'true' });
      set({ publicBots: bots });
    } catch (err) {
      console.error('Failed to load public bots:', err);
    }
  },

  addBot: (bot) => {
    set(state => ({
      bots: [bot, ...state.bots],
      userBots: [bot, ...state.userBots],
    }));
  },

  removeBot: async (botId) => {
    try {
      await apiDeleteBot(botId);
      set(state => ({
        bots: state.bots.filter(b => b.id !== botId),
        userBots: state.userBots.filter(b => b.id !== botId),
      }));
    } catch (err) {
      console.error('Failed to delete bot:', err);
    }
  },

  setGroups: (groups) => set({ groups }),
  addGroup: (group) => set(state => ({
    groups: state.groups.find(g => g.id === group.id)
      ? state.groups  // already in list, don't duplicate
      : [group, ...state.groups]
  })),
}));
