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
// ರಿಯಲ್-ಟೈಮ್ ಚಾಟಿಂಗ್‌ಗಾಗಿ Socket.io ಸೆಟಪ್
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.get('/', (req, res) => {
    res.send('Real-time Storage & Chat API is running!');
});

// Socket.io ಕನೆಕ್ಷನ್ (ಇನ್‌ಸ್ಟಂಟ್ ಚಾಟ್)
io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);
    
    // ಮೆಸೇಜ್ ಬಂದ ತಕ್ಷಣ ಎಲ್ಲರಿಗೂ ರಿಯಲ್-ಟೈಮ್ ಪ್ರಸಾರ ಮಾಡುತ್ತದೆ
    socket.on('sendMessage', (data) => {
        io.emit('receiveMessage', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// ಟೆಲಿಗ್ರಾಮ್ ಸ್ಟೋರೇಜ್ ಅಪ್ಲೋಡ್
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
