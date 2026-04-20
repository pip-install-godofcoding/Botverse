/**
 * Listen Together Room (Spotify sync)
 * 
 * Events in:
 *   join-listen   { roomId, userId, displayName }
 *   track-load    { roomId, embedUrl, trackName, artistName, loadedBy }
 *   listen-chat   { roomId, userId, displayName, text }
 *   leave-listen  { roomId }
 * 
 * Events out:
 *   listen-room-state  { members, currentTrack }
 *   user-joined        { userId, displayName, members }
 *   user-left          { userId, members }
 *   track-loaded       { embedUrl, trackName, artistName, loadedBy }
 *   listen-chat        { userId, displayName, text, time }
 */

const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { members: new Map(), currentTrack: null });
  }
  return rooms.get(roomId);
}

module.exports = function registerListenRoom(io) {
  io.on('connection', (socket) => {

    socket.on('join-listen', ({ roomId, userId, displayName }) => {
      const room = getRoom(roomId);
      socket.join(`listen:${roomId}`);
      room.members.set(socket.id, { userId, displayName });

      socket.emit('listen-room-state', {
        members: [...room.members.values()],
        currentTrack: room.currentTrack,
      });

      socket.to(`listen:${roomId}`).emit('user-joined', {
        userId, displayName, members: [...room.members.values()],
      });
    });

    socket.on('track-load', ({ roomId, embedUrl, trackName, artistName }) => {
      const room = getRoom(roomId);
      const user = room.members.get(socket.id);
      room.currentTrack = { embedUrl, trackName, artistName };
      io.to(`listen:${roomId}`).emit('track-loaded', {
        embedUrl, trackName, artistName, loadedBy: user?.displayName || 'Someone',
      });
    });

    socket.on('listen-chat', ({ roomId, userId, displayName, text }) => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      io.to(`listen:${roomId}`).emit('listen-chat', { userId, displayName, text, time });
    });

    socket.on('leave-listen', ({ roomId }) => leaveRoom(socket, roomId, io));

    socket.on('disconnect', () => {
      rooms.forEach((_, roomId) => {
        const room = rooms.get(roomId);
        if (room?.members.has(socket.id)) leaveRoom(socket, roomId, io);
      });
    });
  });
};

function leaveRoom(socket, roomId, io) {
  const room = rooms.get(roomId);
  if (!room) return;
  const user = room.members.get(socket.id);
  room.members.delete(socket.id);
  socket.leave(`listen:${roomId}`);
  if (room.members.size === 0) {
    rooms.delete(roomId);
  } else {
    io.to(`listen:${roomId}`).emit('user-left', {
      userId: user?.userId, members: [...room.members.values()],
    });
  }
}
