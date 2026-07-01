const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Storage API is running smoothly!');
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const BOT_TOKEN = process.env.BOT_TOKEN;
        const CHAT_ID = process.env.CHAT_ID;

        if (!BOT_TOKEN || !CHAT_ID) {
            return res.status(500).json({ error: 'Server configuration missing' });
        }

        const formData = new FormData();
        formData.append('chat_id', CHAT_ID);
        formData.append('document', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        const telegramRes = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`,
            formData,
            { headers: formData.getHeaders() }
        );

        const fileId = telegramRes.data.result.document.file_id;

        const pathRes = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
        const filePath = pathRes.data.result.file_path;
        
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

        res.json({
            success: true,
            message: 'Uploaded successfully to Telegram!',
            url: fileUrl
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Upload failed', details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
