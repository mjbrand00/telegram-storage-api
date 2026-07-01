const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cors = require('cors');

// --- CONFIGURATION ---
const PORT = process.env.PORT || 10000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB Limit

// Create uploads directory if not exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static files (Dashboard)

// Multer Storage Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        // Allow all file types for now, or restrict here
        cb(null, true);
    }
});

// ==========================================
// 1. TELEGRAM STORAGE API ENDPOINTS
// ==========================================

// Upload File
app.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });        
        const fileInfo = {
            success: true,
            fileName: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimeType: req.file.mimetype,
            url: `/download/${req.file.filename}`,
            uploadedAt: new Date().toISOString()
        };
        
        console.log(`[UPLOAD] ${req.file.originalname} (${req.file.size} bytes)`);
        res.status(201).json(fileInfo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Download File
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(UPLOAD_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// List All Files
app.get('/files', (req, res) => {
    try {
        const files = fs.readdirSync(UPLOAD_DIR).map(file => {
            const stats = fs.statSync(path.join(UPLOAD_DIR, file));
            return {
                name: file,
                size: stats.size,
                createdAt: stats.birthtime
            };
        });
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete File
app.delete('/files/:filename', (req, res) => {
    const filePath = path.join(UPLOAD_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);        res.json({ success: true, message: 'File deleted' });
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// ==========================================
// 2. SYSTEM MONITORING & ADMIN API
// ==========================================

app.get('/api/stats', (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    res.json({
        uptime: process.uptime(),
        memory: {
            total: `${(totalMem / 1024 / 1024).toFixed(2)} MB`,
            used: `${(usedMem / 1024 / 1024).toFixed(2)} MB`,
            free: `${(freeMem / 1024 / 1024).toFixed(2)} MB`,
            percent: ((usedMem / totalMem) * 100).toFixed(1)
        },
        cpu: os.cpus().length + ' Cores',
        platform: os.platform(),
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// 3. BUILT-IN ADMIN DASHBOARD (HTML UI)
// ==========================================

app.get('/', (req, res) => {
    const dashboardHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔥 MJ Brand Server Dashboard</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; }
        h1 { color: #38bdf8; text-align: center; }
        .card { background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .stat-box { background: #334155; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-val { font-size: 1.5rem; font-weight: bold; color: #38bdf8; }        .stat-label { font-size: 0.8rem; color: #94a3b8; }
        input[type="file"] { width: 100%; padding: 10px; background: #334155; border: none; border-radius: 6px; color: white; margin-bottom: 10px; }
        button { background: #38bdf8; color: #0f172a; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%; }
        button:hover { background: #7dd3fc; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #334155; }
        th { color: #38bdf8; }
        .del-btn { background: #ef4444; color: white; padding: 5px 10px; font-size: 0.8rem; width: auto; }
        .status-live { color: #4ade80; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 MJ Brand Super Server</h1>
        
        <div class="card">
            <h3>📊 System Status</h3>
            <div class="stats-grid" id="stats">Loading...</div>
        </div>

        <div class="card">
            <h3>📤 Upload File</h3>
            <input type="file" id="fileInput">
            <button onclick="uploadFile()">Upload to Server</button>
            <p id="uploadStatus" style="margin-top:10px; color:#94a3b8;"></p>
        </div>

        <div class="card">
            <h3>📂 Stored Files</h3>
            <table>
                <thead><tr><th>Name</th><th>Size</th><th>Action</th></tr></thead>
                <tbody id="fileList"></tbody>
            </table>
        </div>
    </div>

    <script>
        async function loadStats() {
            const res = await fetch('/api/stats');
            const data = await res.json();
            document.getElementById('stats').innerHTML = \`
                <div class="stat-box"><div class="stat-val">\${data.memory.percent}%</div><div class="stat-label">RAM Used</div></div>
                <div class="stat-box"><div class="stat-val">\${data.cpu}</div><div class="stat-label">CPU Cores</div></div>
                <div class="stat-box"><div class="stat-val">\${Math.floor(data.uptime/60)}m</div><div class="stat-label">Uptime</div></div>
                <div class="stat-box"><div class="stat-val status-live">LIVE</div><div class="stat-label">Server State</div></div>
            \`;
        }

        async function loadFiles() {
            const res = await fetch('/files');            const files = await res.json();
            const tbody = document.getElementById('fileList');
            tbody.innerHTML = files.map(f => \`
                <tr>
                    <td>\${f.name}</td>
                    <td>\${(f.size/1024).toFixed(1)} KB</td>
                    <td><button class="del-btn" onclick="deleteFile('\${f.name}')">Delete</button></td>
                </tr>
            \`).join('');
        }

        async function uploadFile() {
            const input = document.getElementById('fileInput');
            if(!input.files[0]) return alert('Select a file first!');
            
            const formData = new FormData();
            formData.append('file', input.files[0]);
            
            document.getElementById('uploadStatus').innerText = 'Uploading...';
            const res = await fetch('/upload', { method: 'POST', body: formData });
            const data = await res.json();
            
            if(data.success) {
                document.getElementById('uploadStatus').innerText = '✅ Uploaded: ' + data.fileName;
                loadFiles();
            } else {
                document.getElementById('uploadStatus').innerText = '❌ Error: ' + data.error;
            }
        }

        async function deleteFile(name) {
            if(confirm('Delete ' + name + '?')) {
                await fetch(\`/files/\${name}\`, { method: 'DELETE' });
                loadFiles();
            }
        }

        setInterval(loadStats, 5000);
        loadStats();
        loadFiles();
    </script>
</body>
</html>`;
    res.send(dashboardHTML);
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🔥 MJ BRAND SUPER SERVER IS LIVE!`);    console.log(`🌐 URL: http://localhost:\${PORT}`);
    console.log(`💾 Storage: \${UPLOAD_DIR}`);
    console.log(`========================================\n`);
});
