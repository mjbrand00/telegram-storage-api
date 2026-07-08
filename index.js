const express = require('express');
const cors = require('cors');
const axios = require('axios');
const ytSearch = require('yt-search');
const jiosaavn = require('jiosaavn-api');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ==========================================
// JIOSAAVN SEARCH
// ==========================================
app.get('/api/music/search/jiosaavn', async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;
        if (!q) return res.status(400).json({ error: 'Query required' });

        const results = await jiosaavn.search.songs(q, parseInt(limit));
        
        const songs = results.data.map(song => ({
            id: song.id,
            title: song.name,
            artist: song.primaryArtists,
            album: song.albumName,
            duration: song.duration,
            image: song.image[2]?.url || song.image[0]?.url,
            url: song.downloadUrl[4]?.url || song.downloadUrl[2]?.url, // 320kbps or 160kbps
            source: 'JioSaavn'
        }));

        res.json({ success: true, songs, source: 'JioSaavn' });
    } catch (error) {
        console.error('JioSaavn Error:', error.message);
        res.status(500).json({ error: 'JioSaavn search failed', message: error.message });
    }
});

// ==========================================
// YOUTUBE MUSIC SEARCH
// ==========================================
app.get('/api/music/search/youtube', async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;
        if (!q) return res.status(400).json({ error: 'Query required' });

        const results = await ytSearch(q);
        const videos = results.videos.slice(0, parseInt(limit));

        const songs = videos.map(video => ({
            id: video.videoId,
            title: video.title,
            artist: video.author.name,
            duration: video.duration.timestamp,
            image: video.thumbnail,
            url: `https://www.youtube.com/watch?v=${video.videoId}`,
            source: 'YouTube Music'
        }));

        res.json({ success: true, songs, source: 'YouTube Music' });
    } catch (error) {
        console.error('YouTube Search Error:', error.message);
        res.status(500).json({ error: 'YouTube search failed', message: error.message });
    }
});

// ==========================================
// COMBINED SEARCH (Both Sources)
// ==========================================
app.get('/api/music/search', async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;
        if (!q) return res.status(400).json({ error: 'Query required' });

        const [jiosaavnResults, youtubeResults] = await Promise.allSettled([
            jiosaavn.search.songs(q, Math.ceil(parseInt(limit) / 2)),
            ytSearch(q)
        ]);

        let songs = [];

        // Process JioSaavn results
        if (jiosaavnResults.status === 'fulfilled') {
            const jsSongs = jiosaavnResults.value.data.map(song => ({
                id: `js_${song.id}`,
                title: song.name,
                artist: song.primaryArtists,
                album: song.albumName,
                duration: song.duration,
                image: song.image[2]?.url || song.image[0]?.url,
                url: song.downloadUrl[4]?.url || song.downloadUrl[2]?.url,
                source: 'JioSaavn'
            }));
            songs.push(...jsSongs);
        }

        // Process YouTube results
        if (youtubeResults.status === 'fulfilled') {
            const ytSongs = youtubeResults.value.videos.slice(0, Math.ceil(parseInt(limit) / 2)).map(video => ({
                id: `yt_${video.videoId}`,
                title: video.title,
                artist: video.author.name,
                duration: video.duration.timestamp,
                image: video.thumbnail,
                url: `https://www.youtube.com/watch?v=${video.videoId}`,
                source: 'YouTube Music'
            }));
            songs.push(...ytSongs);
        }

        // Shuffle and limit
        songs = songs.sort(() => 0.5 - Math.random()).slice(0, parseInt(limit));

        res.json({ success: true, songs, total: songs.length });
    } catch (error) {
        console.error('Combined Search Error:', error.message);
        res.status(500).json({ error: 'Search failed', message: error.message });
    }
});

// ==========================================
// GET SONG DETAILS (Direct Stream URL)
// ==========================================
app.get('/api/music/song/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (id.startsWith('js_')) {
            // JioSaavn song
            const songId = id.replace('js_', '');
            const song = await jiosaavn.getSongsByIds([songId]);
            
            if (song && song[0]) {
                res.json({
                    success: true,
                    song: {
                        id: song[0].id,
                        title: song[0].name,
                        artist: song[0].primaryArtists,
                        album: song[0].albumName,
                        duration: song[0].duration,
                        image: song[0].image[2]?.url || song[0].image[0]?.url,
                        url: song[0].downloadUrl[4]?.url || song[0].downloadUrl[2]?.url,
                        source: 'JioSaavn'
                    }
                });
            } else {
                res.status(404).json({ error: 'Song not found' });
            }
        } else if (id.startsWith('yt_')) {
            // YouTube song
            const videoId = id.replace('yt_', '');
            res.json({
                success: true,
                song: {
                    id: videoId,
                    title: 'YouTube Video',
                    artist: 'Unknown',
                    duration: '0:00',
                    image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    source: 'YouTube Music'
                }
            });
        } else {
            res.status(400).json({ error: 'Invalid song ID' });
        }
    } catch (error) {
        console.error('Get Song Error:', error.message);
        res.status(500).json({ error: 'Failed to get song', message: error.message });
    }
});

// ==========================================
// HEALTH CHECK
// ==========================================
app.get('/', (req, res) => {
    res.json({
        api: 'Omega Music API',
        status: 'Online',
        sources: ['JioSaavn', 'YouTube Music'],
        endpoints: {
            search: '/api/music/search?q=<query>&limit=10',
            searchJiosaavn: '/api/music/search/jiosaavn?q=<query>',
            searchYoutube: '/api/music/search/youtube?q=<query>',
            songDetails: '/api/music/song/<id>'
        }
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🎵 Omega Music API running on port ${PORT}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}`);
    console.log(` Search: http://localhost:${PORT}/api/music/search?q=love&limit=5`);
});
