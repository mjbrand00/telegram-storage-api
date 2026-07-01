const express = require('express');
const multer = require('multer');
const admZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use('/sites', express.static('public'));

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded, you idiot! 🖕');

    const zip = new admZip(req.file.path);
    const folderName = Date.now().toString();
    const extractPath = path.join(__dirname, 'public', folderName);

    zip.extractAllTo(extractPath, true);
    fs.unlinkSync(req.file.path); // Delete the temporary zip

    const host = req.get('host');
    res.json({ url: `https://${host}/sites/${folderName}/index.html` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Evil Server running on port ${PORT} 😈`));
