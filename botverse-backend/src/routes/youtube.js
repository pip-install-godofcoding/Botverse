const express = require('express');
const router = express.Router();

// GET /api/youtube/search?q=query
// Works with or without a YOUTUBE_API_KEY. Falls back to free scraping if no key.
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query param q is required' });

  // ── Strategy 1: Use official YouTube Data API if key is available ──
  if (process.env.YOUTUBE_API_KEY) {
    try {
      const axios = require('axios');
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

      return res.json({ results });
    } catch (err) {
      console.error('YouTube API error, falling back to scraping:', err.response?.data?.error?.message || err.message);
      // Fall through to scraping
    }
  }

  // ── Strategy 2: Free scraping fallback (no API key needed) ──
  try {
    const results = await scrapeYouTubeSearch(q);
    return res.json({ results });
  } catch (err) {
    console.error('YouTube scrape error:', err.message);
    res.status(500).json({ error: 'YouTube search failed', detail: err.message });
  }
});

/**
 * Scrape YouTube search results by fetching the search page HTML
 * and extracting the initial data JSON blob that YouTube embeds.
 * No API key required.
 */
async function scrapeYouTubeSearch(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) throw new Error(`YouTube returned ${response.status}`);

  const html = await response.text();

  // YouTube embeds all initial data in a script tag containing `var ytInitialData = {...};`
  const dataMatch = html.match(/var ytInitialData\s*=\s*(\{.+?\});/s);
  if (!dataMatch) throw new Error('Could not parse YouTube search results');

  const data = JSON.parse(dataMatch[1]);

  // Navigate the deeply nested structure to find video results
  const contents = data
    ?.contents
    ?.twoColumnSearchResultsRenderer
    ?.primaryContents
    ?.sectionListRenderer
    ?.contents?.[0]
    ?.itemSectionRenderer
    ?.contents || [];

  const results = [];

  for (const item of contents) {
    const video = item.videoRenderer;
    if (!video) continue;

    results.push({
      id: video.videoId,
      title: video.title?.runs?.[0]?.text || 'Untitled',
      channelName: video.ownerText?.runs?.[0]?.text || 'Unknown',
      thumbnail: video.thumbnail?.thumbnails?.pop()?.url || '',
      description: video.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map(r => r.text).join('') || '',
    });

    if (results.length >= 8) break;
  }

  return results;
}

module.exports = router;
