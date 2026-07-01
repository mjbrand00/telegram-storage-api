const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// ---------- ಸ್ಟೋರ್ (In-memory) ----------
const userSockets = {};
const roomUsersMap = {};

// ---------- ಟೆಲಿಗ್ರಾಮ್ ಅಪ್ಲೋಡ್ (ನಿಮ್ಮ ಹಳೆಯ ಕೋಡ್) ----------
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

app.get('/', (req, res) => {
    res.send('Real-time Storage & Chat API is running!');
});

// ---------- 🔥 ರಿಯಲ್-ಟೈಮ್ ಚಾಟ್ ಸಾಕೆಟ್ ಲಾಜಿಕ್ ----------
io.on('connection', (socket) => {
    console.log('🟢 User connected:', socket.id);

    // 1️⃣ ಯೂಸರ್ ರೂಮ್‌ಗೆ ಜಾಯಿನ್ ಆಗುವುದು
    socket.on('join', ({ username, room }) => {
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
    });

    // 2️⃣ ಮೆಸೇಜ್ ಕಳುಹಿಸುವುದು
    socket.on('message', ({ user, room, text }) => {
        const userData = userSockets[socket.id];
        if (!userData) return;

        const messageData = {
            user: userData.username,
            text: text,
            time: new Date().toISOString()
        };

        io.to(room).emit('message', messageData);
    });

    // 3️⃣ ಆಡ್ಮಿನ್ ಬ್ರಾಡ್ಕಾಸ್ಟ್
    socket.on('broadcast', ({ text, from }) => {
        const broadcastData = {
            text: text,
            from: from || 'Admin',
            time: new Date().toISOString()
        };
        io.emit('broadcast', broadcastData);
        console.log(`📢 Broadcast: ${text}`);
    });

    // 4️⃣ ಡಿಸ್ಕನೆಕ್ಟ್
    socket.on('disconnect', () => {
        const userData = userSockets[socket.id];
        if (userData) {
            const { username, room } = userData;
            if (roomUsersMap[room]) {
                roomUsersMap[room].delete(username);
                io.to(room).emit('room_users', { users: Array.from(roomUsersMap[room]) });
            }
            delete userSockets[socket.id];
            console.log(`🔴 ${username} disconnected from ${room}`);
        } else {
            console.log('🔴 User disconnected:', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
