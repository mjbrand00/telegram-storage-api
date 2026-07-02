const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'omega_data');
const STORAGE_ROOT = path.join(__dirname, 'omega_vault');
const JWT_SECRET = "OMEGA_SECRET_KEY_12345"; // ನಮ್ಮ ಸೀಕ್ರೆಟ್ ಕೀ

// Create directories
[DATA_DIR, STORAGE_ROOT].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ==========================================
// 1️⃣ DATABASE (Users)
// ==========================================
const USERS_FILE = path.join(DATA_DIR, 'users.json');
function loadUsers() {
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
    catch(e) { return []; }
}
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ==========================================
// 2️⃣ CHAT DATABASE
// ==========================================
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');
function loadChats() {
    try { return JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8')); }
    catch(e) { return []; }
}
function saveChats(chats) {
    fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2));
}

// ==========================================
// APP SETUP
// ==========================================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {    cors: { origin: "*" },
    maxHttpBufferSize: 1e8
});

app.use(cors());
app.use(express.json());
app.use('/vault', express.static(STORAGE_ROOT));

// ==========================================
// 🔐 AUTH API (REGISTER & LOGIN)
// ==========================================

// Register New User
app.post('/api/auth/register', async function(req, res) {
    const { username, email, password, age, gender, bio } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const users = loadUsers();
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Password Hashing (Security!)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const newUser = {
        id: Date.now().toString(),
        username,
        email,
        password: hashedPassword,
        age: age || 18,
        gender: gender || 'other',
        bio: bio || '',
        photo: '',
        joinedAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveUsers(users);
    
    // Generate Token
    const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET);
    
    res.json({ 
        success: true, 
        message: "Welcome to Omega Empire!",        token: token,
        user: { id: newUser.id, username: newUser.username, email: newUser.email }
    });
});

// Login User
app.post('/api/auth/login', async function(req, res) {
    const { email, password } = req.body;
    const users = loadUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Check Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Generate Token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    
    res.json({ 
        success: true, 
        message: "Login Successful!",
        token: token,
        user: { id: user.id, username: user.username, email: user.email }
    });
});

// Middleware to check Token (Optional but recommended)
function verifyToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'No token provided' });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// Protected Route Example
app.get('/api/profile', verifyToken, function(req, res) {
    const users = loadUsers();
    const user = users.find(u => u.id === req.user.id);    res.json({ success: true, profile: user });
});

// ==========================================
// CHAT API
// ==========================================
app.post('/api/chat/send', function(req, res) {
    const { roomId, sender, text } = req.body;
    const message = { id: Date.now(), roomId, sender, text, timestamp: new Date().toISOString() };
    
    const chats = loadChats();
    chats.push(message);
    saveChats(chats);
    
    io.to(roomId).emit('receive_message', message);
    res.json({ success: true, message });
});

app.get('/api/chat/:roomId', function(req, res) {
    const chats = loadChats().filter(c => c.roomId === req.params.roomId);
    res.json({ success: true, messages: chats });
});

// ==========================================
// SOCKET.IO
// ==========================================
io.on('connection', function(socket) {
    console.log('User Connected:', socket.id);

    socket.on('join_room', (roomId) => {
        socket.join(roomId);
    });

    socket.on('send_message', (data) => {
        const message = { 
            id: Date.now(), 
            roomId: data.roomId, 
            sender: data.sender, 
            text: data.text, 
            timestamp: new Date().toISOString() 
        };
        
        const chats = loadChats();
        chats.push(message);
        saveChats(chats); // Save permanently
        
        io.to(data.roomId).emit('receive_message', message);
    });
});
// ==========================================
// LAUNCH
// ==========================================
server.listen(PORT, function() {
    console.log(' OMEGA AUTH CORE ONLINE');
    console.log('Port:', PORT);
    console.log('Google? NO. We are independent!');
});
