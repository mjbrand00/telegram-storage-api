/**
 * 🧠 UNLIMITED LOCAL AI SERVER + BEAUTIFUL UI
 * No API Keys | No Limits | Private & Free
 * Requires: Ollama installed on your VPS
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const PORT = process.env.PORT || 4000;
const OLLAMA_API = 'http://localhost:11434'; // Default Ollama port
const MODEL = 'llama3'; // You can change to 'mistral', 'gemma', etc.

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 1. AI CHAT ENDPOINT
// ==========================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history = [] } = req.body;
        
        // Send request to local Ollama
        const response = await axios.post(`${OLLAMA_API}/api/chat`, {
            model: MODEL,
            messages: [
                ...history, // Previous context for memory
                { role: 'user', content: message }
            ],
            stream: false // Get full response at once
        });

        res.json({ 
            success: true, 
            reply: response.data.message.content,
            model: MODEL 
        });
    } catch (error) {
        console.error('AI Error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'AI is thinking... Please ensure Ollama is running!' 
        });
    }
});

// ==========================================// 2. BEAUTIFUL CHAT UI (Single File)
// ==========================================
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🤖 My Private AI</title>
    <style>
        :root { --bg: #0f172a; --card: #1e293b; --primary: #6366f1; --text: #f8fafc; }
        body { margin: 0; font-family: 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); height: 100vh; display: flex; flex-direction: column; }
        
        /* Header */
        header { padding: 15px 20px; background: var(--card); border-bottom: 1px solid #334155; display: flex; align-items: center; gap: 10px; }
        .logo { width: 35px; height: 35px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; }
        h1 { margin: 0; font-size: 1.2rem; font-weight: 600; }
        .badge { font-size: 0.7rem; background: #10b981; padding: 2px 8px; border-radius: 10px; }

        /* Chat Area */
        #chat-box { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; scroll-behavior: smooth; }
        .msg { max-width: 80%; padding: 12px 16px; border-radius: 18px; line-height: 1.5; font-size: 0.95rem; word-wrap: break-word; animation: popIn 0.3s ease; }
        .user-msg { align-self: flex-end; background: var(--primary); border-bottom-right-radius: 4px; }
        .ai-msg { align-self: flex-start; background: var(--card); border-bottom-left-radius: 4px; border: 1px solid #334155; }
        .typing { opacity: 0.7; font-style: italic; font-size: 0.8rem; margin-left: 10px; }

        /* Input Area */
        .input-area { padding: 15px 20px; background: var(--card); display: flex; gap: 10px; border-top: 1px solid #334155; }
        input { flex: 1; padding: 12px 15px; border-radius: 25px; border: 1px solid #475569; background: #0f172a; color: white; outline: none; font-size: 1rem; transition: 0.3s; }
        input:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2); }
        button { padding: 0 20px; border-radius: 25px; border: none; background: var(--primary); color: white; font-weight: bold; cursor: pointer; transition: 0.2s; }
        button:hover { transform: scale(1.05); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }

        @keyframes popIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 600px) { .msg { max-width: 90%; } }
    </style>
</head>
<body>
    <header>
        <div class="logo">🧠</div>
        <h1>Private AI <span class="badge">UNLIMITED</span></h1>
    </header>

    <div id="chat-box">
        <div class="msg ai-msg">Hello! I'm your private AI. Ask me anything, I have no limits! 🚀</div>
    </div>

    <div class="input-area">
        <input type="text" id="user-input" placeholder="Type your message..." autocomplete="off">        <button id="send-btn">Send</button>
    </div>

    <script>
        const chatBox = document.getElementById('chat-box');
        const input = document.getElementById('user-input');
        const btn = document.getElementById('send-btn');
        let history = [];

        async function sendMessage() {
            const text = input.value.trim();
            if (!text) return;

            // Add User Message
            addMessage(text, 'user');
            input.value = '';
            btn.disabled = true;
            
            // Show Typing Indicator
            const typingDiv = document.createElement('div');
            typingDiv.className = 'typing';
            typingDiv.innerText = 'AI is thinking...';
            chatBox.appendChild(typingDiv);
            chatBox.scrollTop = chatBox.scrollHeight;

            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text, history })
                });
                const data = await res.json();
                
                typingDiv.remove();
                if (data.success) {
                    addMessage(data.reply, 'ai');
                    history.push({ role: 'user', content: text });
                    history.push({ role: 'assistant', content: data.reply });
                } else {
                    addMessage('Error: ' + data.error, 'ai');
                }
            } catch (err) {
                typingDiv.remove();
                addMessage('Connection failed. Is Ollama running?', 'ai');
            } finally {
                btn.disabled = false;
                input.focus();
            }
        }
        function addMessage(text, type) {
            const div = document.createElement('div');
            div.className = \`msg \${type === 'user' ? 'user-msg' : 'ai-msg'}\`;
            div.innerText = text;
            chatBox.appendChild(div);
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        btn.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());
    </script>
</body>
</html>`);
});

// START SERVER
app.listen(PORT, () => {
    console.log(`\n🧠 AI SERVER LIVE: http://localhost:${PORT}`);
    console.log(`💡 Make sure Ollama is running: ollama serve\n`);
});
