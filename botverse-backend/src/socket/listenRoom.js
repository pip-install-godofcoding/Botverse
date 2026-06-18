/**
 * Listen Together Room (YouTube Audio sync)
 * 
 * Events in:
 *   join-listen    { roomId, userId, displayName }
 *   track-load     { roomId, trackId, trackTitle, trackArtist, trackThumbnail }
 *   play           { roomId, currentTime }
 *   pause          { roomId, currentTime }
 *   seek           { roomId, seekTo }
 *   toggle-lock    { roomId, locked }
 *   sync-heartbeat { roomId, currentTime, playing }
 *   listen-chat    { roomId, userId, displayName, text }
 *   leave-listen   { roomId }
 */

const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { host: null, members: new Map(), track: null, playing: false, currentTime: 0, isLocked: false });
  }
  return rooms.get(roomId);
}

module.exports = function registerListenRoom(io) {
  io.on('connection', (socket) => {

    socket.on('join-listen', ({ roomId, userId, displayName }) => {
      const room = getRoom(roomId);
      socket.join(`listen:${roomId}`);

      room.members.set(socket.id, { userId, displayName });
      if (!room.host) room.host = socket.id;

      socket.emit('listen-room-state', {
        members: [...room.members.values()],
        track: room.track,
        playing: room.playing,
        currentTime: room.currentTime,
        isHost: room.host === socket.id,
        isLocked: room.isLocked,
      });

      socket.to(`listen:${roomId}`).emit('user-joined', {
        userId, displayName,
        members: [...room.members.values()],
      });
    });

    socket.on('track-load', ({ roomId, trackId, trackTitle, trackArtist, trackThumbnail }) => {
      const room = getRoom(roomId);
      if (room.isLocked && room.host !== socket.id) return;
      
      const track = { trackId, trackTitle, trackArtist, trackThumbnail };
      room.track = track;
      room.playing = false;
      room.currentTime = 0;
      
      const user = room.members.get(socket.id);
      io.to(`listen:${roomId}`).emit('track-loaded', { track, loadedBy: user?.displayName || 'Someone' });
    });

    socket.on('play', ({ roomId, currentTime }) => {
      const room = getRoom(roomId);
      if (room.isLocked && room.host !== socket.id) return;
      room.playing = true;
      room.currentTime = currentTime;
      const user = room.members.get(socket.id);
      socket.to(`listen:${roomId}`).emit('listen-play', { currentTime, by: user?.displayName });
    });

    socket.on('pause', ({ roomId, currentTime }) => {
      const room = getRoom(roomId);
      if (room.isLocked && room.host !== socket.id) return;
      room.playing = false;
      room.currentTime = currentTime;
      const user = room.members.get(socket.id);
      socket.to(`listen:${roomId}`).emit('listen-pause', { currentTime, by: user?.displayName });
    });

    socket.on('seek', ({ roomId, seekTo }) => {
      const room = getRoom(roomId);
      if (room.isLocked && room.host !== socket.id) return;
      room.currentTime = seekTo;
      const user = room.members.get(socket.id);
      socket.to(`listen:${roomId}`).emit('listen-seek', { seekTo, by: user?.displayName });
    });

    socket.on('toggle-lock', ({ roomId, locked }) => {
      const room = getRoom(roomId);
      if (room.host === socket.id) {
        room.isLocked = locked;
        io.to(`listen:${roomId}`).emit('listen-lock-updated', { isLocked: locked });
      }
    });

    socket.on('sync-heartbeat', ({ roomId, currentTime, playing }) => {
      const room = getRoom(roomId);
      if (room.host === socket.id) {
        room.currentTime = currentTime;
        room.playing = playing;
        socket.to(`listen:${roomId}`).emit('listen-host-heartbeat', { currentTime, playing });
      }
    });

    socket.on('listen-chat', ({ roomId, userId, displayName, text }) => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      io.to(`listen:${roomId}`).emit('listen-chat', { userId, displayName, text, time });
    });

    socket.on('leave-listen', ({ roomId }) => {
      leaveRoom(socket, roomId, io);
    });

    socket.on('disconnect', () => {
      rooms.forEach((room, roomId) => {
        if (room.members.has(socket.id)) {
          leaveRoom(socket, roomId, io);
        }
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

  if (room.host === socket.id && room.members.size > 0) {
    room.host = [...room.members.keys()][0];
    io.to(room.host).emit('you-are-listen-host', {});
  }

  if (room.members.size === 0) {
    rooms.delete(roomId);
  } else {
    io.to(`listen:${roomId}`).emit('user-left', {
      userId: user?.userId,
      displayName: user?.displayName,
      members: [...room.members.values()],
    });
  }
}
