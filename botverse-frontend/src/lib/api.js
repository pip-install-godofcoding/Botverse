import axios from 'axios';

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const api = axios.create({ baseURL: BASE });

// ── Chat ──────────────────────────────────────────────────────────────────────
export const sendMessage = (payload) => api.post('/api/chat', payload).then(r => r.data);

// ── YouTube ──────────────────────────────────────────────────────────────────
export const searchYouTube = (q) => api.get('/api/youtube/search', { params: { q } }).then(r => r.data);

// ── Spotify ──────────────────────────────────────────────────────────────────
export const searchSpotify = (q, type = 'track') =>
  api.get('/api/spotify/search', { params: { q, type } }).then(r => r.data);

// ── Bots ─────────────────────────────────────────────────────────────────────
export const fetchBots = (params) => api.get('/api/bots', { params }).then(r => r.data);
export const createBot = async (data) => {
  try {
    const r = await api.post('/api/bots', data);
    return r.data;
  } catch (err) {
    const msg = err.response?.data?.error || err.message;
    throw new Error(msg);
  }
};
export const updateBot = (id, data) => api.put(`/api/bots/${id}`, data).then(r => r.data);
export const deleteBot = (id) => api.delete(`/api/bots/${id}`).then(r => r.data);
export const likeBot = (id) => api.post(`/api/bots/${id}/like`).then(r => r.data);
export const fetchBotMessages = (botId, userId) =>
  api.get(`/api/bots/${botId}/messages`, { params: { user_id: userId } }).then(r => r.data);
export const saveBotMessage = (botId, data) =>
  api.post(`/api/bots/${botId}/messages`, data).then(r => r.data);

// ── Groups ───────────────────────────────────────────────────────────────────
export const fetchGroups = (userId) =>
  api.get('/api/groups', { params: { user_id: userId } }).then(r => r.data);
export const createGroup = (data) => api.post('/api/groups', data).then(r => r.data);
export const joinGroup = (invite_code, user_id) =>
  api.post('/api/groups/join', { invite_code, user_id }).then(r => r.data);
export const fetchGroupMessages = (groupId) =>
  api.get(`/api/groups/${groupId}/messages`).then(r => r.data);
export const saveGroupMessage = (groupId, data) =>
  api.post(`/api/groups/${groupId}/messages`, data).then(r => r.data);

export default api;
