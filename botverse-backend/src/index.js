require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const chatRoutes = require('./routes/chat');
const youtubeRoutes = require('./routes/youtube');
const spotifyRoutes = require('./routes/spotify');
const botsRoutes = require('./routes/bots');
const groupsRoutes = require('./routes/groups');
const agentRoutes = require('./routes/agent');

const registerWatchRoom = require('./socket/watchRoom');
const registerListenRoom = require('./socket/listenRoom');
const registerChatRoom = require('./socket/chatRoom');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CORS_ORIGIN,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
};

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// API routes
app.use('/api/chat', chatRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/bots', botsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/agent', agentRoutes);

// Serve processed files for download
const path = require('path');
const fs = require('fs');
const uploadsDir = path.join(__dirname, '../uploads/tmp');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Socket.io namespaces
registerWatchRoom(io);
registerListenRoom(io);
registerChatRoom(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🤖 BotVerse backend running on http://localhost:${PORT}`);
  console.log(`   Socket.io ready for real-time sync\n`);
});
