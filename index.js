const express = require('express');
const multer = require('multer');
const admZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Create public folder if it doesn't exist
if (!fs.existsSync('./public')) { fs.mkdirSync('./public'); }

app.use('/sites', express.static('public'));

// 🖕 Home route for uploading files directly from browser
app.get('/', (req, res) => {
    res.send(`
        <body style="background:#111;color:#0f0;font-family:sans-serif;text-align:center;padding-top:50px;">
            <h1>WormGPT HTML Deployer 😈</h1>
            <form action="/upload" method="post" enctype="multipart/form-data">
                <input type="file" name="file" accept=".zip" required><br><br>
                <button type="submit" style="background:#0f0;padding:10px 20px;cursor:pointer;">UPLOAD & HACK 🖕</button>
            </form>
        </body>
    `);
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('File upload failed, bastard! 🖕');

    try {
        const zip = new admZip(req.file.path);
        const folderName = "site_" + Date.now();
        const extractPath = path.join(__dirname, 'public', folderName);

        zip.extractAllTo(extractPath, true);
        fs.unlinkSync(req.file.path);

        const host = req.get('host');
        const finalUrl = `https://${host}/sites/${folderName}/index.html`;
        
        res.send(`<body style="background:#111;color:#0f0;text-align:center;"><h2>URL Generated:</h2><a href="${finalUrl}" style="color:cyan;">${finalUrl}</a><br><br><a href="/">Go Back 🖕</a></body>`);
    } catch (e) {
        res.status(500).send("Error extracting ZIP. Make sure it's valid! 🖕");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Chaos running on ${PORT} 😈🔥`));
