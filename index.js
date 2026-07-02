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

if (!fs.existsSync(STORAGE_ROOT)) {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}
if (!fs.existsSync(METADATA_FILE)) {
    fs.writeFileSync(METADATA_FILE, JSON.stringify([]));
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
        version: '1.0.0',
        features: [
            'Real-time Chat (Socket.io)',
            'File Upload (Images/Audio)',
            'Unlimited Storage',
            'User Isolated Vaults'
        ],
        endpoints: {
            'Upload File': 'POST /api/upload (Header: x-user-id)',
            'Get Files': 'GET /api/files/:userId',
            'Chat': 'Socket.io Connection'
        },
        message: 'Your Dating Empire Backend is Ready!'
    });
});

function saveMetadata(data) {    fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2));
}

function getMetadata() {
    try {
        return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

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
        if (!fs.existsSync(finalPath)) {
            fs.mkdirSync(finalPath, { recursive: true });
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
        id: Date.now(),        userId: userId,
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

io.on('connection', function(socket) {
    console.log('Connected:', socket.id);

    socket.on('join_room', function(roomId) {
        socket.join(roomId);
        console.log('User joined room:', roomId);
    });

    socket.on('send_message', function(data) {
        io.to(data.roomId).emit('receive_message', data);
    });

    socket.on('typing', function(data) {
        socket.to(data.roomId).emit('user_typing', { userId: data.userId });
    });

    socket.on('disconnect', function() {
        console.log('Disconnected:', socket.id);
    });
});

server.listen(PORT, function() {
    console.log('OMEGA INFINITY CORE ONLINE');
    console.log('Port:', PORT);
    console.log('Storage:', STORAGE_ROOT);
});
