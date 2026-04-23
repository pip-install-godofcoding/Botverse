/**
 * supabaseGroups.js
 * All group operations go DIRECTLY to Supabase — no Railway backend needed.
 * This bypasses all Railway 502 issues permanently.
 */
import { supabase } from './supabase';

// Create a group and add the creator as a member
export async function createGroupDirect({ name, emoji, creator_id, bot_ids = [] }) {
  const invite_code = Math.random().toString(36).substring(2, 10).toUpperCase();

  // Insert the group
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert([{ name, emoji: emoji || '💬', creator_id, bot_ids, invite_code }])
    .select()
    .single();

  if (groupError) throw new Error(groupError.message);

  // Add creator as a member
  const { error: memberError } = await supabase
    .from('group_members')
    .insert([{ group_id: group.id, user_id: creator_id }]);

  if (memberError) {
    console.warn('Could not add creator as member (RLS policy may be missing):', memberError.message);
    // Don't throw — group was created, member add is best-effort
  }

  return { group };
}

// Fetch all groups the user is a member of
export async function fetchGroupsDirect(user_id) {
  const { data: memberships, error: memberError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user_id);

  if (memberError) throw new Error(memberError.message);
  if (!memberships || memberships.length === 0) return { groups: [] };

  const groupIds = memberships.map((m) => m.group_id);

  const { data: groups, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds)
    .order('created_at', { ascending: false });

  if (groupError) throw new Error(groupError.message);
  return { groups };
}

// Join a group by invite code
export async function joinGroupDirect(invite_code, user_id) {
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_code', invite_code.toUpperCase())
    .single();

  if (groupError || !group) throw new Error('Group not found. Check the invite code.');

  const { error: joinError } = await supabase
    .from('group_members')
    .upsert([{ group_id: group.id, user_id }]);

  if (joinError) throw new Error(joinError.message);
  return { group };
}

// Fetch recent messages for a group
export async function fetchGroupMessagesDirect(groupId, limit = 60) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('group_id', groupId)
    .is('bot_id', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return { messages: data };
}

// Save a group message
export async function saveGroupMessageDirect(groupId, { user_id, content, role = 'user', display_name }) {
  const { data, error } = await supabase
    .from('messages')
    .insert([{ group_id: groupId, user_id, role, content, display_name }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { message: data };
}
