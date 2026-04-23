/**
 * supabaseGroups.js
 * Uses raw fetch() to call Supabase REST API directly.
 * This completely bypasses the Supabase JS client and its session/key issues.
 */

const SUPABASE_URL = 'https://hrnazgyaxmnzhaniwjaj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhybmF6Z3lheG1uemhhbml3amFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODYwODMsImV4cCI6MjA5MjE2MjA4M30.bid6IFOR4b5xvocSwUt08P2pUlndn9Cx6skKSmWuVmk';

// Gets the current user's JWT from Supabase localStorage (set by OAuth redirect)
function getUserJWT() {
  try {
    // Supabase v2 stores the session under this key
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (key) {
      const session = JSON.parse(localStorage.getItem(key));
      return session?.access_token || null;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function headers(jwt) {
  const h = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${jwt || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
  return h;
}

async function sbFetch(path, options = {}) {
  const jwt = getUserJWT();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: headers(jwt),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || data?.error || `Supabase error ${res.status}`);
  return data;
}

// Create a group and add the creator as a member
export async function createGroupDirect({ name, emoji, creator_id, bot_ids = [] }) {
  const invite_code = Math.random().toString(36).substring(2, 10).toUpperCase();

  const groups = await sbFetch('groups', {
    method: 'POST',
    body: JSON.stringify({ name, emoji: emoji || '💬', creator_id, bot_ids, invite_code }),
  });

  const group = Array.isArray(groups) ? groups[0] : groups;
  if (!group) throw new Error('Failed to create group');

  // Add creator as member (best-effort)
  try {
    await sbFetch('group_members', {
      method: 'POST',
      body: JSON.stringify({ group_id: group.id, user_id: creator_id }),
    });
  } catch (e) {
    console.warn('Could not add creator as member:', e.message);
  }

  return { group };
}

// Fetch all groups the user is a member of
export async function fetchGroupsDirect(user_id) {
  const memberships = await sbFetch(`group_members?select=group_id&user_id=eq.${user_id}`);
  if (!memberships || memberships.length === 0) return { groups: [] };

  const ids = memberships.map(m => m.group_id).join(',');
  const groups = await sbFetch(`groups?id=in.(${ids})&order=created_at.desc`);
  return { groups: groups || [] };
}

// Join a group by invite code
export async function joinGroupDirect(invite_code, user_id) {
  const results = await sbFetch(`groups?invite_code=eq.${invite_code.toUpperCase()}`);
  const group = results?.[0];
  if (!group) throw new Error('Group not found. Check the invite code.');

  await sbFetch('group_members', {
    method: 'POST',
    body: JSON.stringify({ group_id: group.id, user_id }),
  });
  return { group };
}

// Fetch recent messages for a group
export async function fetchGroupMessagesDirect(groupId, limit = 60) {
  const messages = await sbFetch(`messages?group_id=eq.${groupId}&bot_id=is.null&order=created_at.asc&limit=${limit}`);
  return { messages: messages || [] };
}

// Save a group message
export async function saveGroupMessageDirect(groupId, { user_id, content, role = 'user', display_name }) {
  const rows = await sbFetch('messages', {
    method: 'POST',
    body: JSON.stringify({ group_id: groupId, user_id, role, content, display_name }),
  });
  return { message: Array.isArray(rows) ? rows[0] : rows };
}
