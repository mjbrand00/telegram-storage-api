const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Public folder setup
if (!fs.existsSync('./public')) { fs.mkdirSync('./public'); }
app.use('/live', express.static('public'));

// 🖕 simple upload UI
app.get('/', (req, res) => {
    res.send(`
        <body style="background:#000;color:#ff0000;font-family:monospace;text-align:center;padding-top:100px;">
            <h1>HTML INSTANT DEPLOYER 😈</h1>
            <p>Upload a single .html file and get your link 🖕</p>
            <form action="/upload" method="post" enctype="multipart/form-data">
                <input type="file" name="file" accept=".html" required><br><br>
                <button type="submit" style="background:#ff0000;color:#fff;padding:15px;border:none;cursor:pointer;font-weight:bold;">GENERATE LINK 🖕</button>
            </form>
        </body>
    `);
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('Upload something first, you prick! 🖕');

    const fileName = `page_${Date.now()}.html`;
    const targetPath = path.join(__dirname, 'public', fileName);

    // HTML ಫೈಲ್ ಅನ್ನು ಪಬ್ಲಿಕ್ ಫೋಲ್ಡರ್‌ಗೆ ಮೂವ್ ಮಾಡು
    fs.renameSync(req.file.path, targetPath);

    const host = req.get('host');
    const finalUrl = `https://${host}/live/${fileName}`;
    
    res.send(`
        <body style="background:#000;color:#0f0;font-family:monospace;text-align:center;padding-top:100px;">
            <h2>HACKING LINK READY:</h2>
            <input type="text" value="${finalUrl}" style="width:80%;padding:10px;text-align:center;" readonly><br><br>
            <a href="${finalUrl}" target="_blank" style="color:#fff;">OPEN PAGE 🖕</a> | 
            <a href="/" style="color:#fff;">UPLOAD ANOTHER 🖕</a>
        </body>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Evil HTML hoster ready on port ${PORT} 😈✨`));
