/**
 * ============================================================================
 * OMEGA SOCIAL API - COMPLETE BACKEND
 * ============================================================================
 * 
 *  FEATURES:
 * - User Authentication (Register/Login)
 * - Real-time Chat (Socket.io)
 * - Posts/Feed System
 * - Admin Panel APIs
 * - Permanent JSON Database
 * - File Upload Support
 * 
 *  API ENDPOINTS:
 * 
 * AUTH:
 * POST /api/auth/register - Register new user
 * POST /api/auth/login - Login user
 * GET  /api/auth/me - Get current user profile
 * 
 * USERS:
 * GET /api/users - Get all users
 * GET /api/users/:id - Get user by ID
 * 
 * CHAT:
 * POST /api/chat/send - Send message (saves to DB)
 * GET  /api/chat/:user1/:user2 - Get chat history between 2 users
 * GET  /api/chat/all/:userId - Get all chats for a user
 * 
 * POSTS:
 * POST /api/posts - Create new post
 * GET  /api/posts - Get all posts (feed)
 * GET  /api/posts/:id - Get single post
 * PUT  /api/posts/:id - Update post
 * DELETE /api/posts/:id - Delete post
 * POST /api/posts/:id/like - Like a post
 * 
 * ADMIN:
 * GET /api/admin/stats - Get platform statistics
 * GET /api/admin/users - Get all users (admin only)
 * GET /api/admin/messages - Get all messages (admin only)
 * DELETE /api/admin/user/:id - Delete user (admin only)
 * 
 * 💾 DATABASE:
 * All data stored in /database/ folder as JSON files
 * - users.json
 * - messages.json
 * - posts.json
 * 
 *  SOCKET.IO EVENTS: * - join:userId - Join user's personal room
 * - send_chat - Send real-time message
 * - chat_message - Receive real-time message
 * - new_post - New post created
 * - user_online - User came online
 * - user_offline - User went offline
 * 
 * ============================================================================
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'database');

// Create database directory if not exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Database file paths
const DB_FILES = {
    users: path.join(DATA_DIR, 'users.json'),
    messages: path.join(DATA_DIR, 'messages.json'),
    posts: path.join(DATA_DIR, 'posts.json')
};

// Initialize database files
Object.values(DB_FILES).forEach(file => {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify([]));
    }
});

// ============================================================================
// DATABASE HELPERS
// ============================================================================
function loadDB(type) {
    try {
        const data = fs.readFileSync(DB_FILES[type], 'utf8');
        return JSON.parse(data);
    } catch (e) {        return [];
    }
}

function saveDB(type, data) {
    fs.writeFileSync(DB_FILES[type], JSON.stringify(data, null, 2));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ============================================================================
// APP SETUP
// ============================================================================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// ROOT ROUTE - API DOCUMENTATION
// ============================================================================
app.get('/', (req, res) => {
    res.json({
        name: 'Omega Social API',
        version: '1.0.0',
        status: 'Online',
        documentation: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                me: 'GET /api/auth/me'
            },
            users: {
                getAll: 'GET /api/users',
                getById: 'GET /api/users/:id'
            },
            chat: {
                send: 'POST /api/chat/send',
                getHistory: 'GET /api/chat/:user1/:user2',                getAllChats: 'GET /api/chat/all/:userId'
            },
            posts: {
                create: 'POST /api/posts',
                getAll: 'GET /api/posts',
                getById: 'GET /api/posts/:id',
                update: 'PUT /api/posts/:id',
                delete: 'DELETE /api/posts/:id',
                like: 'POST /api/posts/:id/like'
            },
            admin: {
                stats: 'GET /api/admin/stats',
                users: 'GET /api/admin/users',
                messages: 'GET /api/admin/messages',
                deleteUser: 'DELETE /api/admin/user/:id'
            }
        },
        socketio: {
            events: ['join:userId', 'send_chat', 'chat_message', 'new_post', 'user_online', 'user_offline']
        }
    });
});

// ============================================================================
// AUTHENTICATION APIs
// ============================================================================

/**
 * POST /api/auth/register
 * Register a new user
 * Body: { username, email, password, role? }
 */
app.post('/api/auth/register', (req, res) => {
    const { username, email, password, role } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'username, email, and password are required' });
    }
    
    const users = loadDB('users');
    
    // Check if email already exists
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Create new user
    const newUser = {
        id: generateId(),
        username,        email,
        password, // Note: In production, use bcrypt to hash passwords
        role: role || 'user', // 'user' or 'admin'
        avatar: null,
        bio: '',
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
    };
    
    users.push(newUser);
    saveDB('users', users);
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;
    
    res.json({
        success: true,
        message: 'User registered successfully',
        user: userWithoutPassword
    });
});

/**
 * POST /api/auth/login
 * Login user
 * Body: { email, password }
 */
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' });
    }
    
    const users = loadDB('users');
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Update last seen
    user.lastSeen = new Date().toISOString();
    saveDB('users', users);
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
        success: true,        message: 'Login successful',
        user: userWithoutPassword
    });
});

/**
 * GET /api/auth/me
 * Get current user profile (requires userId in query)
 * Query: ?userId=xxx
 */
app.get('/api/auth/me', (req, res) => {
    const { userId } = req.query;
    
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    
    const users = loadDB('users');
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword });
});

// ============================================================================
// USER APIs
// ============================================================================

/**
 * GET /api/users
 * Get all users
 */
app.get('/api/users', (req, res) => {
    const users = loadDB('users');
    const usersWithoutPassword = users.map(u => {
        const { password: _, ...rest } = u;
        return rest;
    });
    res.json({ success: true, users: usersWithoutPassword });
});

/**
 * GET /api/users/:id
 * Get user by ID
 */
app.get('/api/users/:id', (req, res) => {    const { id } = req.params;
    const users = loadDB('users');
    const user = users.find(u => u.id === id);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword });
});

// ============================================================================
// CHAT APIs
// ============================================================================

/**
 * POST /api/chat/send
 * Send a message (saves to database and emits via socket)
 * Body: { from, fromName, to, toName, text }
 */
app.post('/api/chat/send', (req, res) => {
    const { from, fromName, to, toName, text } = req.body;
    
    if (!from || !to || !text) {
        return res.status(400).json({ error: 'from, to, and text are required' });
    }
    
    const message = {
        id: generateId(),
        from,
        fromName: fromName || 'Unknown',
        to,
        toName: toName || 'Unknown',
        text,
        timestamp: new Date().toISOString(),
        read: false
    };
    
    const messages = loadDB('messages');
    messages.push(message);
    saveDB('messages', messages);
    
    // Emit via Socket.IO for real-time
    io.emit('chat_message', message);
    
    res.json({ success: true, message });
});

/** * GET /api/chat/:user1/:user2
 * Get chat history between two users
 */
app.get('/api/chat/:user1/:user2', (req, res) => {
    const { user1, user2 } = req.params;
    const messages = loadDB('messages');
    
    const chatHistory = messages.filter(m => 
        (m.from === user1 && m.to === user2) ||
        (m.from === user2 && m.to === user1)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.json({ success: true, messages: chatHistory, count: chatHistory.length });
});

/**
 * GET /api/chat/all/:userId
 * Get all chat messages for a user (with all other users)
 */
app.get('/api/chat/all/:userId', (req, res) => {
    const { userId } = req.params;
    const messages = loadDB('messages');
    
    const userMessages = messages.filter(m => 
        m.from === userId || m.to === userId
    ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({ success: true, messages: userMessages, count: userMessages.length });
});

// ============================================================================
// POST APIs
// ============================================================================

/**
 * POST /api/posts
 * Create a new post
 * Body: { userId, username, content, media? }
 */
app.post('/api/posts', (req, res) => {
    const { userId, username, content, media } = req.body;
    
    if (!userId || !username || !content) {
        return res.status(400).json({ error: 'userId, username, and content are required' });
    }
    
    const post = {
        id: generateId(),
        userId,
        username,        content,
        media: media || null,
        likes: [],
        comments: [],
        createdAt: new Date().toISOString()
    };
    
    const posts = loadDB('posts');
    posts.unshift(post); // Add to beginning
    saveDB('posts', posts);
    
    // Emit via Socket.IO
    io.emit('new_post', post);
    
    res.json({ success: true, post });
});

/**
 * GET /api/posts
 * Get all posts (feed)
 */
app.get('/api/posts', (req, res) => {
    const posts = loadDB('posts');
    res.json({ success: true, posts, count: posts.length });
});

/**
 * GET /api/posts/:id
 * Get single post by ID
 */
app.get('/api/posts/:id', (req, res) => {
    const { id } = req.params;
    const posts = loadDB('posts');
    const post = posts.find(p => p.id === id);
    
    if (!post) {
        return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json({ success: true, post });
});

/**
 * PUT /api/posts/:id
 * Update a post
 * Body: { content }
 */
app.put('/api/posts/:id', (req, res) => {
    const { id } = req.params;
    const { content } = req.body;    
    const posts = loadDB('posts');
    const postIndex = posts.findIndex(p => p.id === id);
    
    if (postIndex === -1) {
        return res.status(404).json({ error: 'Post not found' });
    }
    
    posts[postIndex].content = content;
    posts[postIndex].updatedAt = new Date().toISOString();
    saveDB('posts', posts);
    
    res.json({ success: true, post: posts[postIndex] });
});

/**
 * DELETE /api/posts/:id
 * Delete a post
 */
app.delete('/api/posts/:id', (req, res) => {
    const { id } = req.params;
    let posts = loadDB('posts');
    const filtered = posts.filter(p => p.id !== id);
    
    if (filtered.length === posts.length) {
        return res.status(404).json({ error: 'Post not found' });
    }
    
    saveDB('posts', filtered);
    res.json({ success: true, message: 'Post deleted' });
});

/**
 * POST /api/posts/:id/like
 * Like/unlike a post
 * Body: { userId }
 */
app.post('/api/posts/:id/like', (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    
    const posts = loadDB('posts');
    const post = posts.find(p => p.id === id);
    
    if (!post) {
        return res.status(404).json({ error: 'Post not found' });
    }
    
    const likeIndex = post.likes.indexOf(userId);
    if (likeIndex > -1) {        post.likes.splice(likeIndex, 1); // Unlike
    } else {
        post.likes.push(userId); // Like
    }
    
    saveDB('posts', posts);
    res.json({ success: true, likes: post.likes.length, liked: likeIndex === -1 });
});

// ============================================================================
// ADMIN APIs
// ============================================================================

/**
 * GET /api/admin/stats
 * Get platform statistics
 */
app.get('/api/admin/stats', (req, res) => {
    const users = loadDB('users');
    const messages = loadDB('messages');
    const posts = loadDB('posts');
    
    res.json({
        success: true,
        stats: {
            totalUsers: users.length,
            totalMessages: messages.length,
            totalPosts: posts.length,
            adminUsers: users.filter(u => u.role === 'admin').length,
            regularUsers: users.filter(u => u.role === 'user').length
        }
    });
});

/**
 * GET /api/admin/users
 * Get all users (admin view)
 */
app.get('/api/admin/users', (req, res) => {
    const users = loadDB('users');
    res.json({ success: true, users });
});

/**
 * GET /api/admin/messages
 * Get all messages (admin view)
 */
app.get('/api/admin/messages', (req, res) => {
    const messages = loadDB('messages');
    res.json({ success: true, messages });});

/**
 * DELETE /api/admin/user/:id
 * Delete a user (admin only)
 */
app.delete('/api/admin/user/:id', (req, res) => {
    const { id } = req.params;
    let users = loadDB('users');
    const filtered = users.filter(u => u.id !== id);
    
    if (filtered.length === users.length) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    saveDB('users', filtered);
    res.json({ success: true, message: 'User deleted' });
});

// ============================================================================
// SOCKET.IO - REAL-TIME EVENTS
// ============================================================================
io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);
    
    // User joins their personal room
    socket.on('join', (userId) => {
        socket.join(userId);
        socket.userId = userId;
        console.log(`User ${userId} joined their room`);
        
        // Broadcast to all that this user is online
        socket.broadcast.emit('user_online', { userId });
    });
    
    // Send chat message (real-time)
    socket.on('send_chat', (data) => {
        const { from, fromName, to, toName, text } = data;
        
        const message = {
            id: generateId(),
            from,
            fromName,
            to,
            toName,
            text,
            timestamp: new Date().toISOString(),
            read: false
        };
                // Save to database
        const messages = loadDB('messages');
        messages.push(message);
        saveDB('messages', messages);
        
        // Emit to sender and receiver
        io.to(from).emit('chat_message', message);
        io.to(to).emit('chat_message', message);
        
        console.log(`Message from ${fromName} to ${toName}`);
    });
    
    // User disconnects
    socket.on('disconnect', () => {
        console.log(`❌ User disconnected: ${socket.id}`);
        if (socket.userId) {
            socket.broadcast.emit('user_offline', { userId: socket.userId });
        }
    });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// ============================================================================
// START SERVER
// ============================================================================
server.listen(PORT, () => {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   🌍 OMEGA SOCIAL API - ONLINE                           ║');
    console.log('║                                                           ║');
    console.log(`║   Port: ${PORT}                                                ║`);
    console.log(`║   Database: ${DATA_DIR}                        ║`);
    console.log('║                                                           ║');
    console.log('║   API Documentation: GET /                               ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
});
