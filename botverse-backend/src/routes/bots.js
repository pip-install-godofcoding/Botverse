const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || url.includes('your_') || !url.startsWith('http')) {
    throw new Error('Supabase not configured. Set SUPABASE_URL in .env');
  }
  return createClient(url, key);
}

// GET /api/bots?public=true  — list public bots
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { public: isPublic, creator_id } = req.query;
    let query = supabase.from('bots').select('*').order('created_at', { ascending: false });
    if (isPublic === 'true') query = query.eq('is_public', true);
    if (creator_id) query = query.eq('creator_id', creator_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ bots: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bots — create a bot
router.post('/', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { name, emoji, color, prompt, type, tag, is_public, creator_id, creator_name, tools, custom_code } = req.body;
    if (!name || !prompt || !creator_id) {
      return res.status(400).json({ error: 'name, prompt and creator_id are required' });
    }

    const { data, error } = await supabase.from('bots').insert([{
      name, emoji: emoji || '🤖', color: color || '#6C63FF',
      prompt, type: type || 'character', tag: tag || 'Custom',
      tools: tools || [],
      custom_code: custom_code || null,
      is_public: is_public !== false, creator_id, creator_name,
    }]).select().single();

    if (error) throw error;
    res.json({ bot: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bots/:id — update a bot
router.put('/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const updates = req.body;
    const { data, error } = await supabase.from('bots').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json({ bot: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bots/:id/like — increment popularity
router.post('/:id/like', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    // Call the rpc function if available, or just fetch and increment
    // Since we don't have an RPC function installed, we'll fetch then increment 
    // (In production, use an RPC function to avoid race conditions)
    const { data: bot } = await supabase.from('bots').select('likes').eq('id', id).single();
    if (!bot) throw new Error('Bot not found');
    
    const { data, error } = await supabase.from('bots').update({ likes: (bot.likes || 0) + 1 }).eq('id', id).select().single();
    if (error) throw error;
    res.json({ bot: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bots/:id
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const { error } = await supabase.from('bots').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bots/:id/messages?user_id=xxx  — get conversation history
router.get('/:id/messages', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const { user_id, limit = 50 } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('bot_id', id)
      .eq('user_id', user_id)
      .is('group_id', null)
      .order('created_at', { ascending: true })
      .limit(Number(limit));

    if (error) throw error;
    res.json({ messages: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bots/:id/messages — save message
router.post('/:id/messages', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const { user_id, role, content } = req.body;

    const { data, error } = await supabase.from('messages').insert([{
      bot_id: id, user_id, role, content,
    }]).select().single();

    if (error) throw error;
    res.json({ message: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
