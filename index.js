/**
 * 🔒 PURE DATABASE STORAGE API
 * Only for: Saving & Retrieving Data to MongoDB
 * No Chat | No Calls | No Sockets | Just DB
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
// VPS ಯಲ್ಲಿ MongoDB ಚಾಲನೆಯಲ್ಲಿದ್ದರೆ ಈ URL ಬಳಸಿ
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dating_storage';

// --- EXPRESS SETUP ---
const app = express();
app.use(cors()); // Allow connections from your other server/frontend
app.use(express.json({ limit: '50mb' })); // Handle large data payloads

// ==========================================
// 1. DATABASE CONNECTION (Real-time Connect)
// ==========================================
mongoose.connect(MONGO_URI)
    .then(() => console.log(`✅ DB CONNECTED: ${MONGO_URI}`))
    .catch(err => {
        console.error('❌ DB CONNECTION FAILED:', err);
        process.exit(1); // Stop server if DB fails
    });

// ==========================================
// 2. DATA SCHEMAS (Storage Models)
// ==========================================

// User Profile Storage
const UserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    name: String,
    email: String,
    profilePic: String,
    preferences: Object,
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Chat/Media Metadata Storage (Actual files stored elsewhere)
const ContentSchema = new mongoose.Schema({
    senderId: String,
    receiverId: String,
    type: { type: String, enum: ['text', 'image', 'voice', 'video'] },
    contentUrl: String, // Link to file storage    metadata: Object,
    timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Content = mongoose.model('Content', ContentSchema);

// ==========================================
// 3. STORAGE API ENDPOINTS
// ==========================================

// ✅ SAVE USER PROFILE
app.post('/api/users', async (req, res) => {
    try {
        const user = await User.findOneAndUpdate(
            { userId: req.body.userId },
            req.body,
            { upsert: true, new: true }
        );
        res.status(201).json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ GET USER PROFILE
app.get('/api/users/:userId', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.params.userId });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ SAVE CONTENT (Chat/Image/Voice Metadata)
app.post('/api/content', async (req, res) => {
    try {
        const content = await Content.create(req.body);
        res.status(201).json({ success: true, data: content });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ GET CONTENT HISTORY
app.get('/api/content/:id1/:id2', async (req, res) => {
    try {
        const { id1, id2 } = req.params;        const contents = await Content.find({
            $or: [
                { senderId: id1, receiverId: id2 },
                { senderId: id2, receiverId: id1 }
            ]
        }).sort({ timestamp: -1 }).limit(100);
        
        res.json({ success: true, count: contents.length, data: contents });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ DELETE CONTENT
app.delete('/api/content/:contentId', async (req, res) => {
    try {
        await Content.findByIdAndDelete(req.params.contentId);
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ HEALTH CHECK (For monitoring)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        dbState: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        uptime: process.uptime() 
    });
});

// START SERVER
app.listen(PORT, () => {
    console.log(`\n🔒 STORAGE API LIVE ON PORT ${PORT}`);
    console.log(`💾 Ready to receive data from your main server\n`);
});
