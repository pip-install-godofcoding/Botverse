/**
 * Watch Together Room (YouTube sync)
 * 
 * Room ID: "watch:{roomId}"  (roomId defaults to 'global' for the main watch-together bot)
 * 
 * Events in:
 *   join-watch    { roomId, userId, displayName }
 *   video-load    { roomId, videoId, loadedBy }
 *   play          { roomId, currentTime }
 *   pause         { roomId, currentTime }
 *   seek          { roomId, seekTo }
 *   chat-msg      { roomId, userId, displayName, text }
 *   leave-watch   { roomId, userId }
 * 
 * Events out (broadcast to room):
 *   room-state    { members, videoId, playing, currentTime }
 *   user-joined   { userId, displayName, members }
 *   user-left     { userId, displayName, members }
 *   video-loaded  { videoId, loadedBy }
 *   video-play    { currentTime, by }
 *   video-pause   { currentTime, by }
 *   video-seek    { seekTo, by }
 *   chat-msg      { userId, displayName, text, time }
 */

const rooms = new Map(); // roomId → { host, members, videoId, playing, currentTime }

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { host: null, members: new Map(), videoId: null, playing: false, currentTime: 0 });
  }
  return rooms.get(roomId);
}

module.exports = function registerWatchRoom(io) {
  io.on('connection', (socket) => {

    socket.on('join-watch', ({ roomId, userId, displayName }) => {
      const room = getRoom(roomId);
      socket.join(`watch:${roomId}`);

      room.members.set(socket.id, { userId, displayName });
      if (!room.host) room.host = socket.id;

      // Send current room state to the joining user
      socket.emit('room-state', {
        members: [...room.members.values()],
        videoId: room.videoId,
        playing: room.playing,
        currentTime: room.currentTime,
        isHost: room.host === socket.id,
      });

      // Notify others
      socket.to(`watch:${roomId}`).emit('user-joined', {
        userId, displayName,
        members: [...room.members.values()],
      });
    });

    socket.on('video-load', ({ roomId, videoId }) => {
      const room = getRoom(roomId);
      room.videoId = videoId;
      room.playing = false;
      room.currentTime = 0;
      const user = room.members.get(socket.id);
      io.to(`watch:${roomId}`).emit('video-loaded', { videoId, loadedBy: user?.displayName || 'Someone' });
    });

    socket.on('play', ({ roomId, currentTime }) => {
      const room = getRoom(roomId);
      room.playing = true;
      room.currentTime = currentTime;
      const user = room.members.get(socket.id);
      socket.to(`watch:${roomId}`).emit('video-play', { currentTime, by: user?.displayName });
    });

    socket.on('pause', ({ roomId, currentTime }) => {
      const room = getRoom(roomId);
      room.playing = false;
      room.currentTime = currentTime;
      const user = room.members.get(socket.id);
      socket.to(`watch:${roomId}`).emit('video-pause', { currentTime, by: user?.displayName });
    });

    socket.on('seek', ({ roomId, seekTo }) => {
      const room = getRoom(roomId);
      room.currentTime = seekTo;
      const user = room.members.get(socket.id);
      socket.to(`watch:${roomId}`).emit('video-seek', { seekTo, by: user?.displayName });
    });

    socket.on('watch-chat', ({ roomId, userId, displayName, text }) => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      io.to(`watch:${roomId}`).emit('watch-chat', { userId, displayName, text, time });
    });

    socket.on('leave-watch', ({ roomId }) => {
      leaveRoom(socket, roomId, io);
    });

    socket.on('disconnect', () => {
      // Clean up all rooms this socket was in
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
  socket.leave(`watch:${roomId}`);

  // Assign new host if host left
  if (room.host === socket.id && room.members.size > 0) {
    room.host = [...room.members.keys()][0];
    io.to(room.host).emit('you-are-host', {});
  }

  if (room.members.size === 0) {
    rooms.delete(roomId);
  } else {
    io.to(`watch:${roomId}`).emit('user-left', {
      userId: user?.userId,
      displayName: user?.displayName,
      members: [...room.members.values()],
    });
  }
}
