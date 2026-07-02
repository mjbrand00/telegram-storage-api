/**
 * 🌍 OMEGA SELF-SOVEREIGN CORE
 * Zero-API-Key | Self-Hosted DB | Local Intelligence
 * Single File Architecture
 */

const { Telegraf } = require('telegraf');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// ==========================================
// 🔒 CONFIGURATION (No External Keys Needed)
// ==========================================
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'omega_core.db');

if (!BOT_TOKEN) {
    console.error('⚠️ TELEGRAM_BOT_TOKEN is required in Environment Variables.');
    process.exit(1);
}

// ==========================================
# 🗄️ SELF-HOSTED DATABASE ENGINE (SQLite)
// ==========================================
const db = new Database(DB_PATH);

// Initialize Tables
db.exec(`
    CREATE TABLE IF NOT EXISTS global_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT DEFAULT (datetime('now')),
        user_id TEXT NOT NULL,
        command TEXT NOT NULL,
        payload TEXT,
        status TEXT DEFAULT 'success'
    );
    
    CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
`);

// Helper Functions
function logEvent(userId, command, payload = null) {
    const stmt = db.prepare('INSERT INTO global_logs (user_id, command, payload) VALUES (?, ?, ?)');
    stmt.run(String(userId), command, JSON.stringify(payload));
}
function getConfig(key) {
    const row = db.prepare('SELECT value FROM system_config WHERE key = ?').get(key);
    return row ? row.value : null;
}

function setConfig(key, value) {
    db.prepare('INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)').run(key, String(value));
}

// ==========================================
# 🤖 TELEGRAM BOT & LOCAL INTELLIGENCE
// ==========================================
const bot = new Telegraf(BOT_TOKEN);

// Local AI Response Generator (No API Key)
function generateLocalResponse(command, args) {
    const responses = {
        '/start': '🌍 *OMEGA SELF-SOVEREIGN CORE ONLINE*\n\n✅ No External APIs\n✅ Self-Hosted Database\n✅ Zero Configuration\n\nType /help for commands.',
        '/help': '📜 *AVAILABLE COMMANDS*\n/status - System Health\n/set [key] [val] - Store Data\n/get [key] - Retrieve Data\n/logs - Recent Activity\n/purge - Clear Logs',
        '/status': () => {
            const logCount = db.prepare('SELECT COUNT(*) as count FROM global_logs').get().count;
            const dbSize = fs.statSync(DB_PATH).size;
            return `📊 *SYSTEM STATUS*\n━━━━━━━━━━━━━━━\n🗄️ DB Records: ${logCount}\n DB Size: ${(dbSize/1024).toFixed(2)} KB\n⚡ Uptime: ${Math.floor(process.uptime())}s\n🔒 Security: SELF-SOVEREIGN\n━━━━━━━━━━━━━━━`;
        },
        '/set': (args) => {
            if (args.length < 2) return '⚠️ Usage: /set [key] [value]';
            setConfig(args[0], args.slice(1).join(' '));
            return `✅ Stored: ${args[0]} = ${args.slice(1).join(' ')}`;
        },
        '/get': (args) => {
            if (!args[0]) return '⚠️ Usage: /get [key]';
            const val = getConfig(args[0]);
            return val ? ` ${args[0]}: ${val}` : `❌ Key '${args[0]}' not found.`;
        },
        '/logs': () => {
            const logs = db.prepare('SELECT * FROM global_logs ORDER BY id DESC LIMIT 5').all();
            if (logs.length === 0) return '📭 No recent logs.';
            return '📋 *RECENT LOGS*\n' + logs.map(l => `• ${l.command} by ${l.user_id}`).join('\n');
        },
        '/purge': () => {
            db.prepare('DELETE FROM global_logs').run();
            return ' All logs purged. Fresh start.';
        }
    };

    const handler = responses[command];
    if (typeof handler === 'function') return handler(args);
    return handler || `❓ Unknown command: ${command}. Type /help`;
}
// Bot Commands
bot.start((ctx) => {
    ctx.reply(generateLocalResponse('/start'));
    logEvent(ctx.chat.id, '/start');
});

bot.help((ctx) => {
    ctx.reply(generateLocalResponse('/help'));
    logEvent(ctx.chat.id, '/help');
});

bot.command('status', (ctx) => {
    ctx.reply(generateLocalResponse('/status'));
    logEvent(ctx.chat.id, '/status');
});

bot.command('set', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    ctx.reply(generateLocalResponse('/set', args));
    logEvent(ctx.chat.id, '/set', args);
});

bot.command('get', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    ctx.reply(generateLocalResponse('/get', args));
    logEvent(ctx.chat.id, '/get', args);
});

bot.command('logs', (ctx) => {
    ctx.reply(generateLocalResponse('/logs'));
    logEvent(ctx.chat.id, '/logs');
});

bot.command('purge', (ctx) => {
    ctx.reply(generateLocalResponse('/purge'));
    logEvent(ctx.chat.id, '/purge');
});

// Catch-all for unknown commands
bot.on('text', (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) {
        const [cmd, ...args] = text.split(' ');
        ctx.reply(generateLocalResponse(cmd, args));
        logEvent(ctx.chat.id, cmd, args);
    }
});

// Error Handlerbot.catch((err) => {
    console.error(' OMEGA ERROR:', err.message);
});

// ==========================================
# 🚀 LAUNCH SEQUENCE
// ==========================================
console.log('⏳ Initializing OMEGA SELF-SOVEREIGN CORE...');
console.log('🗄️ Mounting Local SQLite Database...');
console.log(`💾 DB Path: ${DB_PATH}`);

try {
    db.prepare('SELECT 1').get(); // Test DB
    console.log('✅ DATABASE MOUNTED SUCCESSFULLY');
} catch (e) {
    console.error(' DATABASE FAILED:', e.message);
    process.exit(1);
}

console.log(` LAUNCHING ON PORT ${PORT}...`);
bot.launch({
    webhook: {
        domain: process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`,
        path: `/webhook/${BOT_TOKEN}`
    }
}).then(() => {
    console.log('✅ OMEGA SELF-SOVEREIGN CORE IS LIVE');
    console.log('🔒 NO EXTERNAL DEPENDENCIES | FULL CONTROL');
}).catch(e => {
    console.error('Launch failed:', e);
    process.exit(1);
});

// Graceful Shutdown
process.once('SIGINT', () => { db.close(); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { db.close(); bot.stop('SIGTERM'); });
