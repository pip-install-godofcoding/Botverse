const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || url.includes('your_') || !url.startsWith('http')) {
    throw new Error('Supabase not configured.');
  }
  return createClient(url, key);
}

// GET /api/groups — list user's groups
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const { data: memberships, error: memberError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user_id);

    if (memberError) throw memberError;

    const groupIds = memberships.map(m => m.group_id);
    if (groupIds.length === 0) return res.json({ groups: [] });

    const { data: groups, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds)
      .order('created_at', { ascending: false });

    if (groupError) throw groupError;
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups — create group
router.post('/', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { name, emoji, creator_id, bot_ids } = req.body;
    const invite_code = Math.random().toString(36).substring(2, 10).toUpperCase();

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert([{ name, emoji: emoji || '💬', creator_id, bot_ids: bot_ids || [], invite_code }])
      .select()
      .single();

    if (groupError) throw groupError;

    // Add creator as member
    await supabase.from('group_members').insert([{ group_id: group.id, user_id: creator_id }]);

    res.json({ group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/join — join by invite code
router.post('/join', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { invite_code, user_id } = req.body;
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', invite_code)
      .single();

    if (groupError || !group) return res.status(404).json({ error: 'Group not found' });

    const { error: joinError } = await supabase.from('group_members').upsert([
      { group_id: group.id, user_id }
    ]);

    if (joinError) throw joinError;
    res.json({ group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/:id/messages
router.get('/:id/messages', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const { limit = 60 } = req.query;

    const { data, error } = await supabase
      .from('messages')
      .select('*, users(display_name, avatar_url)')
      .eq('group_id', id)
      .is('bot_id', null)
      .order('created_at', { ascending: true })
      .limit(Number(limit));

    if (error) throw error;
    res.json({ messages: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/:id/messages — save group message
router.post('/:id/messages', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const { user_id, content, role = 'user', display_name } = req.body;

    const { data, error } = await supabase.from('messages').insert([{
      group_id: id, user_id, role, content, display_name,
    }]).select().single();

    if (error) throw error;
    res.json({ message: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
