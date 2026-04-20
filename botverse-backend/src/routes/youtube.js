const express = require('express');
const axios = require('axios');
const router = express.Router();

// GET /api/youtube/search?q=query
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query param q is required' });

  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: process.env.YOUTUBE_API_KEY,
        q,
        part: 'snippet',
        type: 'video',
        maxResults: 8,
        safeSearch: 'none',
        videoEmbeddable: 'true',
      },
    });

    const results = response.data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channelName: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
    }));

    res.json({ results });
  } catch (err) {
    console.error('YouTube search error:', err.response?.data || err.message);
    res.status(500).json({ error: 'YouTube search failed', detail: err.response?.data?.error?.message || err.message });
  }
});

module.exports = router;
