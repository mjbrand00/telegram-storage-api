const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'omega_data');
const STORAGE_ROOT = path.join(__dirname, 'omega_vault');

// Create directories
[DATA_DIR, STORAGE_ROOT].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ==========================================
// 1️⃣ RELATIONAL DB (SQLite-like with JSON)
// ==========================================
const USERS_FILE = path.join(DATA_DIR, 'users.json');
function loadUsers() {
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
    catch(e) { return []; }
}
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
function createUser(data) {
    const users = loadUsers();
    const user = {
        id: crypto.randomUUID(),
        email: data.email,
        password: crypto.createHash('sha256').update(data.password).digest('hex'),
        name: data.name,
        age: data.age,
        gender: data.gender,
        location: data.location,
        bio: data.bio || '',
        photos: [],
        createdAt: new Date().toISOString()
    };
    users.push(user);
    saveUsers(users);
    return user;
}
function findUserByEmail(email) {
    return loadUsers().find(u => u.email === email);
}function findUserById(id) {
    return loadUsers().find(u => u.id === id);
}

// ==========================================
// 2️⃣ NoSQL DB (MongoDB-like with JSON)
// ==========================================
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');
function loadChats() {
    try { return JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8')); }
    catch(e) { return []; }
}
function saveChats(chats) {
    fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2));
}
function saveMessage(message) {
    const chats = loadChats();
    chats.push(message);
    saveChats(chats);
    return message;
}
function getChatHistory(roomId) {
    return loadChats().filter(m => m.roomId === roomId);
}

// ==========================================
// 3️⃣ Object Storage (S3-like with File System)
// ==========================================
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const userId = req.headers['x-user-id'] || 'public';
        let typeFolder = 'misc';
        if (file.mimetype.startsWith('image')) typeFolder = 'images';
        else if (file.mimetype.startsWith('audio')) typeFolder = 'audio';
        else if (file.mimetype.startsWith('video')) typeFolder = 'videos';
        
        const finalPath = path.join(STORAGE_ROOT, userId, typeFolder);
        if (!fs.existsSync(finalPath)) fs.mkdirSync(finalPath, { recursive: true });
        cb(null, finalPath);
    },
    filename: function(req, file, cb) {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({ storage: storage });

// ==========================================
// 4️⃣ In-Memory DB (Redis-like)
// ==========================================const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
let sessions = {};
try { sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')); } catch(e) {}

function saveSessions() {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}
function createSession(userId) {
    const token = crypto.randomUUID();
    sessions[token] = {
        userId: userId,
        online: true,
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString()
    };
    saveSessions();
    return token;
}
function getSession(token) {
    return sessions[token] || null;
}
function updateOnlineStatus(userId, online) {
    Object.keys(sessions).forEach(token => {
        if (sessions[token].userId === userId) {
            sessions[token].online = online;
            sessions[token].lastSeen = new Date().toISOString();
        }
    });
    saveSessions();
}
function getOnlineUsers() {
    return Object.values(sessions).filter(s => s.online).map(s => s.userId);
}

// ==========================================
// 5️⃣ Search Engine (Elasticsearch-like)
// ==========================================
const SEARCH_FILE = path.join(DATA_DIR, 'search_index.json');
function loadSearchIndex() {
    try { return JSON.parse(fs.readFileSync(SEARCH_FILE, 'utf8')); }
    catch(e) { return []; }
}
function saveSearchIndex(index) {
    fs.writeFileSync(SEARCH_FILE, JSON.stringify(index, null, 2));
}
function indexUser(user) {
    const index = loadSearchIndex();
    const existing = index.findIndex(u => u.id === user.id);
    const userData = {
        id: user.id,        name: user.name.toLowerCase(),
        bio: user.bio.toLowerCase(),
        location: user.location.toLowerCase(),
        age: user.age,
        gender: user.gender
    };
    if (existing >= 0) index[existing] = userData;
    else index.push(userData);
    saveSearchIndex(index);
}
function searchUsers(query, filters = {}) {
    const index = loadSearchIndex();
    let results = index;
    
    if (query) {
        const q = query.toLowerCase();
        results = results.filter(u => 
            u.name.includes(q) || u.bio.includes(q) || u.location.includes(q)
        );
    }
    if (filters.age) {
        results = results.filter(u => u.age >= filters.age.min && u.age <= filters.age.max);
    }
    if (filters.gender) {
        results = results.filter(u => u.gender === filters.gender);
    }
    if (filters.location) {
        results = results.filter(u => u.location.toLowerCase().includes(filters.location.toLowerCase()));
    }
    return results;
}

// ==========================================
// 6️⃣ Graph DB (Neo4j-like for Matching)
// ==========================================
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');
function loadMatches() {
    try { return JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf8')); }
    catch(e) { return []; }
}
function saveMatches(matches) {
    fs.writeFileSync(MATCHES_FILE, JSON.stringify(matches, null, 2));
}
function createMatch(userId1, userId2) {
    const matches = loadMatches();
    const match = {
        id: crypto.randomUUID(),
        user1: userId1,
        user2: userId2,
        matchedAt: new Date().toISOString(),        status: 'pending' // pending, accepted, rejected
    };
    matches.push(match);
    saveMatches(matches);
    return match;
}
function getMatches(userId) {
    return loadMatches().filter(m => m.user1 === userId || m.user2 === userId);
}
function calculateCompatibility(user1, user2) {
    let score = 0;
    if (user1.age === user2.age) score += 20;
    if (Math.abs(user1.age - user2.age) <= 2) score += 15;
    if (user1.location === user2.location) score += 30;
    if (user1.gender !== user2.gender) score += 25;
    const commonWords = user1.bio.split(' ').filter(w => user2.bio.toLowerCase().includes(w.toLowerCase()));
    score += commonWords.length * 2;
    return Math.min(score, 100);
}

// ==========================================
// EXPRESS APP SETUP
// ==========================================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8
});

app.use(cors());
app.use(express.json());
app.use('/vault', express.static(STORAGE_ROOT));

// ROOT ROUTE
app.get('/', function(req, res) {
    res.json({
        status: '🌍 OMEGA INFINITY CORE v3.0 ONLINE',
        databases: {
            '1. Relational (Users)': 'users.json',
            '2. NoSQL (Chats)': 'chats.json',
            '3. Object Storage': 'omega_vault/',
            '4. In-Memory (Sessions)': 'sessions.json',
            '5. Search Engine': 'search_index.json',
            '6. Graph DB (Matches)': 'matches.json'
        },
        endpoints: {
            'Register': 'POST /api/auth/register',
            'Login': 'POST /api/auth/login',
            'Upload File': 'POST /api/upload',            'Send Message': 'POST /api/chat/send',
            'Get Chat History': 'GET /api/chat/:roomId',
            'Search Users': 'GET /api/search?q=query&age_min=18&age_max=30',
            'Get Matches': 'GET /api/matches/:userId',
            'Create Match': 'POST /api/matches'
        }
    });
});

// ==========================================
// AUTH API
// ==========================================
app.post('/api/auth/register', function(req, res) {
    const { email, password, name, age, gender, location, bio } = req.body;
    
    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (findUserByEmail(email)) {
        return res.status(400).json({ error: 'Email already exists' });
    }
    
    const user = createUser({ email, password, name, age, gender, location, bio });
    indexUser(user);
    const token = createSession(user.id);
    
    res.json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name },
        token: token
    });
});

app.post('/api/auth/login', function(req, res) {
    const { email, password } = req.body;
    const user = findUserByEmail(email);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    if (user.password !== hashedPassword) {
        return res.status(401).json({ error: 'Invalid password' });
    }
    
    const token = createSession(user.id);
    updateOnlineStatus(user.id, true);
        res.json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name },
        token: token
    });
});

// ==========================================
// FILE UPLOAD API
// ==========================================
app.post('/api/upload', upload.single('file'), function(req, res) {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const userId = req.headers['x-user-id'] || 'public';
    const fileName = req.file.filename;
    const typeFolder = req.file.destination.split(path.sep).pop();
    const fileUrl = '/vault/' + userId + '/' + typeFolder + '/' + fileName;
    
    // Update user profile with photo
    const user = findUserById(userId);
    if (user) {
        const users = loadUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex >= 0) {
            users[userIndex].photos.push(fileUrl);
            saveUsers(users);
        }
    }
    
    res.json({
        success: true,
        url: req.protocol + '://' + req.get('host') + fileUrl,
        fileId: Date.now()
    });
});

// ==========================================
// CHAT API
// ==========================================
app.post('/api/chat/send', function(req, res) {
    const { roomId, sender, text, type, mediaUrl } = req.body;
    
    if (!roomId || !sender || !text) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const message = {
        id: Date.now(),        roomId: roomId,
        sender: sender,
        text: text,
        type: type || 'text',
        mediaUrl: mediaUrl || null,
        timestamp: new Date().toISOString()
    };
    
    saveMessage(message);
    io.to(roomId).emit('receive_message', message);
    
    res.json({ success: true, message: message });
});

app.get('/api/chat/:roomId', function(req, res) {
    const messages = getChatHistory(req.params.roomId);
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    res.json({ success: true, messages: messages, count: messages.length });
});

// ==========================================
// SEARCH API
// ==========================================
app.get('/api/search', function(req, res) {
    const query = req.query.q || '';
    const filters = {
        age: req.query.age_min && req.query.age_max ? {
            min: parseInt(req.query.age_min),
            max: parseInt(req.query.age_max)
        } : null,
        gender: req.query.gender || null,
        location: req.query.location || null
    };
    
    const results = searchUsers(query, filters);
    res.json({ success: true, results: results, count: results.length });
});

// ==========================================
// MATCHING API
// ==========================================
app.post('/api/matches', function(req, res) {
    const { user1, user2 } = req.body;
    
    if (!user1 || !user2) {
        return res.status(400).json({ error: 'Missing user IDs' });
    }
    
    const u1 = findUserById(user1);
    const u2 = findUserById(user2);    
    if (!u1 || !u2) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const compatibility = calculateCompatibility(u1, u2);
    const match = createMatch(user1, user2);
    
    res.json({
        success: true,
        match: match,
        compatibility: compatibility + '%'
    });
});

app.get('/api/matches/:userId', function(req, res) {
    const matches = getMatches(req.params.userId);
    res.json({ success: true, matches: matches, count: matches.length });
});

// ==========================================
// SOCKET.IO REAL-TIME
// ==========================================
io.on('connection', function(socket) {
    console.log('Connected:', socket.id);

    socket.on('join_room', function(roomId) {
        socket.join(roomId);
        socket.emit('joined_room', { roomId: roomId, success: true });
    });

    socket.on('send_message', function(data) {
        const message = {
            id: Date.now(),
            roomId: data.roomId,
            sender: data.sender,
            text: data.text,
            type: data.type || 'text',
            mediaUrl: data.mediaUrl || null,
            timestamp: new Date().toISOString()
        };
        
        saveMessage(message);
        io.to(data.roomId).emit('receive_message', message);
    });

    socket.on('typing', function(data) {
        socket.to(data.roomId).emit('user_typing', { userId: data.userId });
    });
    socket.on('user_online', function(userId) {
        updateOnlineStatus(userId, true);
        io.emit('user_status_change', { userId: userId, online: true });
    });

    socket.on('user_offline', function(userId) {
        updateOnlineStatus(userId, false);
        io.emit('user_status_change', { userId: userId, online: false });
    });

    socket.on('disconnect', function() {
        console.log('Disconnected:', socket.id);
    });
});

// ==========================================
// LAUNCH
// ==========================================
server.listen(PORT, function() {
    console.log(' OMEGA INFINITY CORE v3.0 ONLINE');
    console.log('Port:', PORT);
    console.log('Data Directory:', DATA_DIR);
    console.log('Storage Directory:', STORAGE_ROOT);
    console.log('Databases: 6/6 Active');
});
