/**
 * 🌍 OMEGA INFINITY CORE - SINGLE FILE EDITION
 * No VPS Headache | Render Compatible | All-in-One
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
const PORT = process.env.PORT || 3000;
const STORAGE_ROOT = path.join(__dirname, 'omega_vault');
const METADATA_FILE = path.join(__dirname, 'files_metadata.json');

// Ensure directories exist
if (!fs.existsSync(STORAGE_ROOT)) fs.mkdirSync(STORAGE_ROOT);
if (!fs.existsSync(METADATA_FILE)) fs.writeFileSync(METADATA_FILE, JSON.stringify([]));

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }, // Allow any website/app to connect
    maxHttpBufferSize: 1e8 // Allow files up to 100MB
});

app.use(cors());
app.use(express.json());
// Serve static files from the vault
app.use('/vault', express.static(STORAGE_ROOT));

// ==========================================
// 💾 SIMPLE FILE DATABASE (JSON)
// ==========================================
function saveMetadata(data) {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2));
}

function getMetadata() {
    try {
        return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}
// ==========================================
//  FILE UPLOAD ENGINE
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.headers['x-user-id'] || 'public';
        const userFolder = path.join(STORAGE_ROOT, userId);
        if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder, { recursive: true });
        
        // Organize by type
        let typeFolder = 'misc';
        if (file.mimetype.startsWith('image')) typeFolder = 'images';
        if (file.mimetype.startsWith('audio')) typeFolder = 'audio';
        
        const finalPath = path.join(userFolder, typeFolder);
        if (!fs.existsSync(finalPath)) fs.mkdirSync(finalPath, { recursive: true });
        
        cb(null, finalPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

// API: Upload File
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const userId = req.headers['x-user-id'] || 'public';
    const fileName = req.file.filename;
    const typeFolder = req.file.destination.split(path.sep).pop();
    
    // Create URL
    const fileUrl = `/vault/${userId}/${typeFolder}/${fileName}`;
    
    // Save to Metadata
    const metadata = getMetadata();
    metadata.push({
        id: Date.now(),
        userId,
        fileName,
        url: fileUrl,
        type: req.file.mimetype,
        uploadedAt: new Date().toISOString()
    });
    saveMetadata(metadata);    
    res.json({
        success: true,
        message: 'File secured in Omega Vault',
        url: `${req.protocol}://${req.get('host')}${fileUrl}`,
        fileId: Date.now()
    });
});

// API: Get User Files
app.get('/api/files/:userId', (req, res) => {
    const metadata = getMetadata();
    const userFiles = metadata.filter(f => f.userId === req.params.userId);
    res.json({ success: true, files: userFiles });
});

// ==========================================
// 💬 REAL-TIME CHAT ENGINE
// ==========================================
io.on('connection', (socket) => {
    console.log(`🔗 Connected: ${socket.id}`);

    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`User joined room: ${roomId}`);
    });

    socket.on('send_message', (data) => {
        // data: { roomId, sender, text, mediaUrl?, type: 'text'|'image'|'audio' }
        io.to(data.roomId).emit('receive_message', data);
    });

    socket.on('typing', (data) => {
        socket.to(data.roomId).emit('user_typing', { userId: data.userId });
    });

    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id}`);
    });
});

// ==========================================
# 🚀 LAUNCH
// ==========================================
server.listen(PORT, () => {
    console.log(`🌍 OMEGA INFINITY CORE ONLINE`);
    console.log(` Port: ${PORT}`);
    console.log(` Storage: ${STORAGE_ROOT}`);
    console.log(` Ready for your Dating Empire!`);
});
