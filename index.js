const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const STORAGE_ROOT = path.join(__dirname, 'omega_vault');
const METADATA_FILE = path.join(__dirname, 'files_metadata.json');
const CHATS_FILE = path.join(__dirname, 'chats_database.json');

if (!fs.existsSync(STORAGE_ROOT)) {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}
if (!fs.existsSync(METADATA_FILE)) {
    fs.writeFileSync(METADATA_FILE, JSON.stringify([]));
}
if (!fs.existsSync(CHATS_FILE)) {
    fs.writeFileSync(CHATS_FILE, JSON.stringify([]));
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8
});

app.use(cors());
app.use(express.json());
app.use('/vault', express.static(STORAGE_ROOT));

app.get('/', function(req, res) {
    res.json({
        status: '🌍 OMEGA INFINITY CORE ONLINE',
        version: '2.0',
        features: [
            'Real-time Chat (Socket.io)',
            'Permanent Chat Storage',
            'File Upload (Images/Audio)',
            'Unlimited Storage',
            'User Isolated Vaults',
            'Chat History API'
        ],
        endpoints: {
            'Upload File': 'POST /api/upload (Header: x-user-id)',
            'Get Files': 'GET /api/files/:userId',
            'Send Message': 'POST /api/chat/send',            'Get Chat History': 'GET /api/chat/:roomId',
            'Real-time Chat': 'Socket.io Connection'
        },
        message: 'Your Dating Empire Backend is Ready!'
    });
});

// DATABASE FUNCTIONS
function saveToFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadFromFile(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveMetadata(data) {
    saveToFile(METADATA_FILE, data);
}

function getMetadata() {
    return loadFromFile(METADATA_FILE);
}

function saveChats(data) {
    saveToFile(CHATS_FILE, data);
}

function getChats() {
    return loadFromFile(CHATS_FILE);
}

// FILE UPLOAD
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const userId = req.headers['x-user-id'] || 'public';
        let typeFolder = 'misc';
        
        if (file.mimetype.startsWith('image')) {
            typeFolder = 'images';
        } else if (file.mimetype.startsWith('audio')) {
            typeFolder = 'audio';
        }
        
        const finalPath = path.join(STORAGE_ROOT, userId, typeFolder);
        if (!fs.existsSync(finalPath)) {            fs.mkdirSync(finalPath, { recursive: true });
        }
        
        cb(null, finalPath);
    },
    filename: function(req, file, cb) {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ storage: storage });

app.post('/api/upload', upload.single('file'), function(req, res) {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const userId = req.headers['x-user-id'] || 'public';
    const fileName = req.file.filename;
    const typeFolder = req.file.destination.split(path.sep).pop();
    const fileUrl = '/vault/' + userId + '/' + typeFolder + '/' + fileName;
    
    const metadata = getMetadata();
    metadata.push({
        id: Date.now(),
        userId: userId,
        fileName: fileName,
        url: fileUrl,
        type: req.file.mimetype,
        uploadedAt: new Date().toISOString()
    });
    saveMetadata(metadata);
    
    res.json({
        success: true,
        message: 'File uploaded successfully',
        url: req.protocol + '://' + req.get('host') + fileUrl,
        fileId: Date.now()
    });
});

app.get('/api/files/:userId', function(req, res) {
    const metadata = getMetadata();
    const userFiles = metadata.filter(function(f) {
        return f.userId === req.params.userId;
    });
    res.json({ success: true, files: userFiles });
});
// CHAT API ENDPOINTS
app.post('/api/chat/send', function(req, res) {
    const { roomId, sender, text, type, mediaUrl } = req.body;
    
    if (!roomId || !sender || !text) {
        return res.status(400).json({ error: 'Missing required fields: roomId, sender, text' });
    }
    
    const message = {
        id: Date.now(),
        roomId: roomId,
        sender: sender,
        text: text,
        type: type || 'text',
        mediaUrl: mediaUrl || null,
        timestamp: new Date().toISOString()
    };
    
    const chats = getChats();
    chats.push(message);
    saveChats(chats);
    
    // Broadcast to all users in the room
    io.to(roomId).emit('receive_message', message);
    
    res.json({
        success: true,
        message: 'Message sent',
        data: message
    });
});

app.get('/api/chat/:roomId', function(req, res) {
    const roomId = req.params.roomId;
    const chats = getChats();
    
    const roomChats = chats.filter(function(msg) {
        return msg.roomId === roomId;
    });
    
    // Sort by timestamp
    roomChats.sort(function(a, b) {
        return new Date(a.timestamp) - new Date(b.timestamp);
    });
    
    res.json({
        success: true,
        roomId: roomId,
        messages: roomChats,
        count: roomChats.length    });
});

app.delete('/api/chat/:roomId', function(req, res) {
    const roomId = req.params.roomId;
    const chats = getChats();
    
    const filteredChats = chats.filter(function(msg) {
        return msg.roomId !== roomId;
    });
    
    saveChats(filteredChats);
    
    res.json({
        success: true,
        message: 'Chat history deleted for room: ' + roomId
    });
});

// SOCKET.IO REAL-TIME CHAT
io.on('connection', function(socket) {
    console.log('Connected:', socket.id);

    socket.on('join_room', function(roomId) {
        socket.join(roomId);
        console.log('User', socket.id, 'joined room:', roomId);
        
        // Send success confirmation
        socket.emit('joined_room', { roomId: roomId, success: true });
    });

    socket.on('send_message', function(data) {
        // data should contain: roomId, sender, text, type, mediaUrl
        
        // Save to database
        const message = {
            id: Date.now(),
            roomId: data.roomId,
            sender: data.sender,
            text: data.text,
            type: data.type || 'text',
            mediaUrl: data.mediaUrl || null,
            timestamp: new Date().toISOString()
        };
        
        const chats = getChats();
        chats.push(message);
        saveChats(chats);
        
        // Broadcast to all users in the room (including sender)        io.to(data.roomId).emit('receive_message', message);
    });

    socket.on('typing', function(data) {
        socket.to(data.roomId).emit('user_typing', { 
            userId: data.userId,
            roomId: data.roomId 
        });
    });

    socket.on('disconnect', function() {
        console.log('Disconnected:', socket.id);
    });
});

server.listen(PORT, function() {
    console.log('OMEGA INFINITY CORE ONLINE');
    console.log('Port:', PORT);
    console.log('Storage:', STORAGE_ROOT);
    console.log('Chat Database:', CHATS_FILE);
});
