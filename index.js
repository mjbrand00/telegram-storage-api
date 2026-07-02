/**
 * 🌍 OMEGA SELF-SOVEREIGN CORE v2.0
 * Zero-API-Key | Self-Hosted DB | Local Intelligence
 * Fixed Syntax Errors & Render Compatibility
 */

const { Telegraf } = require('telegraf');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// ==========================================
//  CONFIGURATION
// ==========================================
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'omega_core.db');

if (!BOT_TOKEN) {
    console.error('⚠️ TELEGRAM_BOT_TOKEN is required in Environment Variables.');
    process.exit(1);
}

// ==========================================
// 🗄️ SELF-HOSTED DATABASE ENGINE (SQL.JS)
// ==========================================
let db;

async function initDatabase() {
    const SQL = await initSqlJs();
    
    // Load existing DB or create new one
    try {
        if (fs.existsSync(DB_PATH)) {
            const fileBuffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(fileBuffer);
            console.log(' Existing database loaded.');
        } else {
            db = new SQL.Database();
            console.log('🆕 New database created.');
        }
    } catch (e) {
        console.error('❌ DB Load Failed:', e.message);
        db = new SQL.Database();
    }

    // Initialize Tables
    db.run(`
        CREATE TABLE IF NOT EXISTS global_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,            timestamp TEXT DEFAULT (datetime('now')),
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
    
    saveDatabase();
    console.log('✅ DATABASE MOUNTED SUCCESSFULLY');
}

function saveDatabase() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

// Helper Functions
function logEvent(userId, command, payload = null) {
    if (!db) return;
    db.run('INSERT INTO global_logs (user_id, command, payload) VALUES (?, ?, ?)', 
        [String(userId), command, JSON.stringify(payload)]);
    saveDatabase();
}

function getConfig(key) {
    if (!db) return null;
    const stmt = db.prepare('SELECT value FROM system_config WHERE key = ?');
    stmt.bind([key]);
    if (stmt.step()) {
        const val = stmt.get()[0];
        stmt.free();
        return val;
    }
    stmt.free();
    return null;
}

function setConfig(key, value) {
    if (!db) return;
    db.run('INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)', [key, String(value)]);
    saveDatabase();
}
// ==========================================
// 🤖 TELEGRAM BOT & LOCAL INTELLIGENCE
// ==========================================
const bot = new Telegraf(BOT_TOKEN);

// Local AI Response Generator
function generateLocalResponse(command, args) {
    const responses = {
        '/start': '🌍 *OMEGA SELF-SOVEREIGN CORE ONLINE*\n\n✅ No External APIs\n✅ Self-Hosted Database\n✅ Zero Configuration\n\nType /help for commands.',
        '/help': '📜 *AVAILABLE COMMANDS*\n/status - System Health\n/set [key] [val] - Store Data\n/get [key] - Retrieve Data\n/logs - Recent Activity\n/purge - Clear Logs',
        '/status': () => {
            let logCount = 0;
            try {
                const stmt = db.prepare('SELECT COUNT(*) as count FROM global_logs');
                stmt.step();
                logCount = stmt.get()[0];
                stmt.free();
            } catch(e) {}
            
            const dbSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
            return `📊 *SYSTEM STATUS*\n━━━━━━━━━━━━━━━\n️ DB Records: ${logCount}\n DB Size: ${(dbSize/1024).toFixed(2)} KB\n Uptime: ${Math.floor(process.uptime())}s\n🔒 Security: SELF-SOVEREIGN\n━━━━━━━━━━━━━━━`;
        },
        '/set': (args) => {
            if (args.length < 2) return '️ Usage: /set [key] [value]';
            setConfig(args[0], args.slice(1).join(' '));
            return `✅ Stored: ${args[0]} = ${args.slice(1).join(' ')}`;
        },
        '/get': (args) => {
            if (!args[0]) return '⚠️ Usage: /get [key]';
            const val = getConfig(args[0]);
            return val ? ` ${args[0]}: ${val}` : `❌ Key '${args[0]}' not found.`;
        },
        '/logs': () => {
            if (!db) return '📭 DB Offline.';
            const stmt = db.prepare('SELECT * FROM global_logs ORDER BY id DESC LIMIT 5');
            const logs = [];
            while(stmt.step()) {
                const row = stmt.get();
                logs.push(`• ${row[3]} by ${row[2]}`);
            }
            stmt.free();
            if (logs.length === 0) return '📭 No recent logs.';
            return '📋 *RECENT LOGS*\n' + logs.join('\n');
        },
        '/purge': () => {
            if (!db) return 'DB Offline.';
            db.run('DELETE FROM global_logs');
            saveDatabase();
            return '🧹 All logs purged. Fresh start.';        }
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
    if (text.startsWith('/')) {        const [cmd, ...args] = text.split(' ');
        ctx.reply(generateLocalResponse(cmd, args));
        logEvent(ctx.chat.id, cmd, args);
    }
});

// Error Handler
bot.catch((err) => {
    console.error(' OMEGA ERROR:', err.message);
});

// ==========================================
// 🚀 LAUNCH SEQUENCE
// ==========================================
console.log('⏳ Initializing OMEGA SELF-SOVEREIGN CORE v2.0...');

initDatabase().then(() => {
    console.log(`🚀 LAUNCHING ON PORT ${PORT}...`);
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
}).catch(e => {
    console.error('DB Init failed:', e);
    process.exit(1);
});

// Graceful Shutdown
process.once('SIGINT', () => { saveDatabase(); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { saveDatabase(); bot.stop('SIGTERM'); });
