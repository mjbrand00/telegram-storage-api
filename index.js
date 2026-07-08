cat > ~/YOUTUBEAPI/index.js << 'EOF'
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // UI HTML files ಇರೋ public folder

// 🔍 JioSaavn Search
app.get('/search', async (req, res) => {
  const query = req.query.query;
  if (!query) return res.json({ error: 'Query required' });

  try {
    const response = await axios.get('https://www.jiosaavn.com/api.php', {
      params: {
        __call: 'search.getResults',
        query: query,
        p: 1,
        n: 20,
        ctx: 'web6dot0',
        api_version: 4,
        format: 'json',
      },
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const results = response.data?.results || [];
    const songs = results.map(item => ({
      id: item.id || 'unknown',
      title: item.title || item.song || 'No Title',
      artist: item.primary_artists || item.artist || 'Unknown Artist',
      album: item.album || 'Single',
      duration: parseInt(item.duration) || 180,
      image: item.image || item.album_image || 'https://via.placeholder.com/300',
      source: 'jiosaavn',
      url: `https://www.jiosaavn.com/song/${item.id}`
    }));

    res.json(songs);
  } catch (error) {
    console.error('JioSaavn Error:', error.message);
    // Fallback: Demo tracks if API fails
    res.json([
      { id: 'demo1', title: 'Sample Track 1', artist: 'Demo Artist', album: 'Album', duration: 180, image: 'https://via.placeholder.com/300?text=Music', source: 'demo' },
      { id: 'demo2', title: 'Sample Track 2', artist: 'Demo Artist', album: 'Album', duration: 200, image: 'https://via.placeholder.com/300?text=Music', source: 'demo' }
    ]);
  }
});

// 🎵 Stream/Play endpoint (Proxy for audio)
app.get('/play', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('URL required');
  
  try {
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    response.data.pipe(res);
  } catch (err) {
    res.status(500).send('Error fetching audio');
  }
});

// Health check for Render (keep alive)
app.get('/ping', (req, res) => res.send('pong'));

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 Music API running on port ${PORT}`);
});
EOF
