const OpenAI = require('openai');
const vm = require('vm');

let aiClient = null;
let currentModel = '';

function initAIClient() {
  if (aiClient) return;
  if (process.env.GROQ_API_KEY || (process.env.XAI_API_KEY && process.env.XAI_API_KEY.startsWith('gsk_'))) {
    const key = process.env.GROQ_API_KEY || process.env.XAI_API_KEY;
    aiClient = new OpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1' });
    currentModel = 'llama-3.3-70b-versatile';
  } else if (process.env.XAI_API_KEY) {
    aiClient = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: 'https://api.xai.com/v1' });
    currentModel = 'grok-2-latest';
  } else if (process.env.SARVAM_API_KEY) {
    aiClient = new OpenAI({ apiKey: process.env.SARVAM_API_KEY, baseURL: 'https://api.sarvam.ai/v1' });
    currentModel = 'sarvam-105b';
  }
}

const rooms = new Map(); // groupId → { members: Map }

/**
 * Group Chat Room
 * 
 * Events in:
 *   join-group   { groupId, userId, displayName, avatarUrl }
 *   group-msg    { groupId, userId, displayName, text, bots: [{id, name, prompt, type}] }
 *   leave-group  { groupId }
 * 
 * Events out:
 *   group-history    { messages }   → on join
 *   group-msg        { id, userId, displayName, text, time, avatarUrl }
 *   bot-typing       { botName }
 *   bot-reply        { id, botName, botEmoji, text, time }
 *   user-joined      { displayName, members }
 *   user-left        { displayName, members }
 */

module.exports = function registerChatRoom(io) {
  io.on('connection', (socket) => {

    socket.on('join-group', ({ groupId, userId, displayName, avatarUrl }) => {
      if (!groupId) return;
      socket.join(`group:${groupId}`);

      if (!rooms.has(groupId)) rooms.set(groupId, { members: new Map() });
      const room = rooms.get(groupId);
      room.members.set(socket.id, { userId, displayName, avatarUrl });

      socket.to(`group:${groupId}`).emit('user-joined', {
        displayName,
        members: [...room.members.values()],
      });
    });

    socket.on('group-msg', async ({ groupId, userId, displayName, avatarUrl, text, bots = [] }) => {
      if (!groupId || !text?.trim()) return;

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const msgId = `${Date.now()}-${Math.random()}`;

      // Broadcast the user's message to all in room
      io.to(`group:${groupId}`).emit('group-msg', {
        id: msgId, userId, displayName, avatarUrl,
        text, time, role: 'user',
      });

      // Check if any bot was @mentioned — flexible matching
      const textLower = text.toLowerCase();
      
      for (const bot of bots) {
        const nameLower = bot.name.toLowerCase();
        const firstName = nameLower.split(' ')[0];
        
        const wasMentioned =
          textLower.includes(`@${nameLower}`) ||
          textLower.includes(`@${firstName}`) ||
          // also respond if user just starts with the bot name (e.g. "Gojo explain...")
          (bots.length === 1 && textLower.startsWith(firstName));

        if (wasMentioned) {
          console.log(`[group] Bot triggered: ${bot.name} in group ${groupId}`);
          // Signal typing
          io.to(`group:${groupId}`).emit('bot-typing', { botName: bot.name, botEmoji: bot.emoji });

          try {
            initAIClient();
            if (!aiClient) throw new Error('No AI Client configured in backend.');

            const { maxTokens, suffix } = getBotConfig(bot.type);
            
            // ─── Execute Custom App Logic (prompt-to-app sandbox) ───
            let customData = '';
            if (bot.custom_code) {
              try {
                console.log(`[sandbox] Executing custom code for ${bot.name}...`);
                const sandbox = {
                  fetch: globalThis.fetch,
                  console: console, // Allow logging for debugging inside sandbox
                  __PAYLOAD: ''
                };
                vm.createContext(sandbox);
                
                // bot.custom_code is an async IIFE. runInContext returns the Promise.
                const script = new vm.Script(bot.custom_code);
                const execution = script.runInContext(sandbox, { timeout: 5000 });
                await execution; // Wait for the async API fetches to complete
                
                if (sandbox.__PAYLOAD) {
                  customData = `\n\n[LIVE EXTRACTED DATA FROM APP]:\n${sandbox.__PAYLOAD}`;
                  console.log(`[sandbox] Success. Payload length: ${sandbox.__PAYLOAD.length}`);
                }
              } catch (sandboxErr) {
                console.error('[sandbox] Execution failed:', sandboxErr.message);
                customData = `\n\n[APP ERROR]: Component failed to fetch data: ${sandboxErr.message}`;
              }
            }

            const systemPrompt = bot.prompt + suffix + customData;

            const response = await aiClient.chat.completions.create({
              model: currentModel,
              max_tokens: maxTokens,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
              ],
            });
            const reply = response.choices?.[0]?.message?.content || '...';
            const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            io.to(`group:${groupId}`).emit('bot-reply', {
              id: `bot-${Date.now()}-${Math.random()}`,
              botId: bot.id,
              botName: bot.name,
              botEmoji: bot.emoji || '🤖',
              botColor: bot.color || '#6C63FF',
              text: reply,
              time: replyTime,
            });
          } catch (err) {
            console.error('Bot reply error:', err.message);
            io.to(`group:${groupId}`).emit('bot-reply', {
              id: `bot-err-${Date.now()}`,
              botId: bot.id, botName: bot.name,
              botEmoji: bot.emoji || '🤖', botColor: bot.color || '#6C63FF',
              text: `⚠️ I couldn’t respond right now: ${err.message}`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            });
          }
          break; // Only trigger first mentioned bot per message
        }
      }
    });

    socket.on('leave-group', ({ groupId }) => leaveGroup(socket, groupId, io));

    socket.on('disconnect', () => {
      rooms.forEach((_, groupId) => {
        const room = rooms.get(groupId);
        if (room?.members.has(socket.id)) leaveGroup(socket, groupId, io);
      });
    });

    // --- Smart Board Synchronization ---
    socket.on('join-board', ({ boardId }) => {
      if (boardId) socket.join(`board:${boardId}`);
    });

    socket.on('draw-line', ({ boardId, line }) => {
      if (!boardId) return;
      socket.to(`board:${boardId}`).emit('draw-line', line);
    });

    socket.on('clear-board', ({ boardId }) => {
      if (!boardId) return;
      socket.to(`board:${boardId}`).emit('clear-board');
    });

  });
};

function leaveGroup(socket, groupId, io) {
  const room = rooms.get(groupId);
  if (!room) return;
  const user = room.members.get(socket.id);
  room.members.delete(socket.id);
  socket.leave(`group:${groupId}`);
  if (room.members.size === 0) {
    rooms.delete(groupId);
  } else if (user) {
    io.to(`group:${groupId}`).emit('user-left', {
      displayName: user.displayName,
      members: [...room.members.values()],
    });
  }
}

function getBotConfig(botType) {
  if (botType === 'character') {
    return {
      maxTokens: 150,
      suffix: '\n\nREPLY RULES: Short 1-2 sentences, texting style, stay fully in character. This is a group chat.',
    };
  }
  return {
    maxTokens: 800,
    suffix: '\n\nREPLY RULES: Be helpful and concise. You are in a group chat.',
  };
}
