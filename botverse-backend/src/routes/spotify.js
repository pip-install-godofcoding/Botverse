const express = require('express');
const axios = require('axios');
const router = express.Router();

// GET /api/spotify/search?q=query
// Note: We've seamlessly swapped the backend provider to Apple Music (iTunes API)
// because it's 100% free and requires zero authentication, while preserving the exact 
// same data format that our React frontend expects for Spotify.
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query param q is required' });

  try {
    const response = await axios.get('https://itunes.apple.com/search', {
      params: {
        term: q,
        entity: 'song',
        limit: 8,
      },
    });

    const results = response.data.results.map(track => {
      // Convert standard music URL to embed URL
      // e.g. https://music.apple.com/us/album/yellow/1122782080?i=1122782283
      // into https://embed.music.apple.com/us/album/yellow/1122782080?i=1122782283
      const embedUrl = track.trackViewUrl.replace('music.apple.com', 'embed.music.apple.com');
      
      return {
        id: track.trackId.toString(),
        type: 'track',
        name: track.trackName,
        artists: track.artistName,
        albumName: track.collectionName,
        // Upgrade low-res artwork
        albumArt: track.artworkUrl100.replace('100x100bb', '600x600bb'),
        previewUrl: track.previewUrl,
        duration: track.trackTimeMillis,
        embedUrl: embedUrl,
        externalUrl: track.trackViewUrl,
      };
    });

    res.json({ results });
  } catch (err) {
    console.error('Music search error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Music search failed', detail: err.message });
  }
});

module.exports = router;
