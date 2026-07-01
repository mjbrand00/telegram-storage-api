const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// ============ MongoDB Connection ============
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatdb';
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ============ Message Model (Inline) ============
const MessageSchema = new mongoose.Schema({
    user: { type: String, required: true },
    room: { type: String, required: true },
    text: { type: String, required: true },
    time: { type: Date, default: Date.now },
    isBroadcast: { type: Boolean, default: false }
});
const Message = mongoose.model('Message', MessageSchema);

// ============ In-memory for online users ============
const userSockets = {};
const roomUsersMap = {};

// ============ Telegram Upload ============
const upload = multer({ storage: multer.memoryStorage() });
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file' });

        const BOT_TOKEN = process.env.BOT_TOKEN;
        const CHAT_ID = process.env.CHAT_ID;

        const formData = new FormData();
        formData.append('chat_id', CHAT_ID);
        formData.append('document', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        const telegramRes = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`,
            formData,
            { headers: formData.getHeaders() }
        );

        const fileId = telegramRes.data.result.document.file_id;
        const pathRes = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${pathRes.data.result.file_path}`;

        res.json({ success: true, url: fileUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ API: Get chat history ============
app.get('/api/messages/:room', async (req, res) => {
    try {
        const room = req.params.room;
        const messages = await Message.find({ room }).sort({ time: 1 }).limit(100);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('Real-time Storage & Chat API is running!');
});

// ============ 🔥 Socket.IO with Permanent Storage ============
io.on('connection', (socket) => {
    console.log('🟢 User connected:', socket.id);

    // 1️⃣ Join room & load history
    socket.on('join', async ({ username, room }) => {
        // Remove from old room
        if (userSockets[socket.id]) {
            const oldRoom = userSockets[socket.id].room;
            if (roomUsersMap[oldRoom]) {
                roomUsersMap[oldRoom].delete(userSockets[socket.id].username);
                io.to(oldRoom).emit('room_users', { users: Array.from(roomUsersMap[oldRoom] || []) });
            }
        }

        socket.join(room);
        userSockets[socket.id] = { username, room };

        if (!roomUsersMap[room]) roomUsersMap[room] = new Set();
        roomUsersMap[room].add(username);

        io.to(room).emit('room_users', { users: Array.from(roomUsersMap[room]) });
        console.log(`📥 ${username} joined ${room}`);

        // 🔥 Load last 50 messages from DB
        try {
            const history = await Message.find({ room }).sort({ time: 1 }).limit(50);
            socket.emit('chat_history', history);
        } catch (err) {
            console.error('History error:', err);
        }
    });

    // 2️⃣ Message - Save to DB & Broadcast
    socket.on('message', async ({ user, room, text }) => {
        const userData = userSockets[socket.id];
        if (!userData) return;

        const messageData = {
            user: userData.username,
            room: room,
            text: text,
            time: new Date()
        };

        // 🔥 Save to MongoDB
        try {
            const saved = await Message.create(messageData);
            // Broadcast to room
            io.to(room).emit('message', saved);
        } catch (err) {
            console.error('Save error:', err);
        }
    });

    // 3️⃣ Broadcast - Save & Send to all rooms
    socket.on('broadcast', async ({ text, from }) => {
        const broadcastData = {
            user: '📢 Admin',
            room: 'all',
            text: text,
            time: new Date(),
            isBroadcast: true
        };

        // 🔥 Save to DB
        try {
            const saved = await Message.create(broadcastData);
            io.emit('broadcast', { text: saved.text, from: from || 'Admin', time: saved.time });
        } catch (err) {
            console.error('Broadcast save error:', err);
        }
    });

    // 4️⃣ Disconnect
    socket.on('disconnect', () => {
        const userData = userSockets[socket.id];
        if (userData) {
            const { username, room } = userData;
            if (roomUsersMap[room]) {
                roomUsersMap[room].delete(username);
                io.to(room).emit('room_users', { users: Array.from(roomUsersMap[room]) });
            }
            delete userSockets[socket.id];
            console.log(`🔴 ${username} disconnected`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
