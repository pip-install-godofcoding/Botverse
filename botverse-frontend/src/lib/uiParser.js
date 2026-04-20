export function parseGenerativeUI(text) {
  if (!text) return { cleanText: '', uiPayload: null, artifactPayload: null };

  let cleanText = text;
  let uiPayload = null;
  let artifactPayload = null;

  // ─── 1. Parse <artifact> blocks using string index (safe for large HTML) ─────
  const OPEN_TAG_RE = /<artifact([^>]*)>/i;
  const CLOSE_TAG = '</artifact>';
  const openMatch = cleanText.match(OPEN_TAG_RE);

  if (openMatch) {
    try {
      const startIdx = cleanText.indexOf(openMatch[0]);
      const contentStart = startIdx + openMatch[0].length;
      const closeIdx = cleanText.indexOf(CLOSE_TAG, contentStart);

      // Extract the HTML code — use everything after opening tag if closing tag is missing
      const code = closeIdx !== -1
        ? cleanText.substring(contentStart, closeIdx).trim()
        : cleanText.substring(contentStart).trim();

      // Parse attributes like type="html" title="Snake Game"
      const attrsStr = openMatch[1];
      const typeMatch = attrsStr.match(/type=["']([^"']*)["']/i);
      const titleMatch = attrsStr.match(/title=["']([^"']*)["']/i);

      artifactPayload = {
        type: typeMatch ? typeMatch[1] : 'html',
        title: titleMatch ? titleMatch[1] : 'App',
        code,
      };

      // Strip artifact block from clean text
      const endIdx = closeIdx !== -1 ? closeIdx + CLOSE_TAG.length : cleanText.length;
      cleanText = (cleanText.substring(0, startIdx) + cleanText.substring(endIdx)).trim();
    } catch (e) {
      console.error('[Generative UI] Failed to parse artifact:', e);
    }
  }

  // ─── 2. Parse <ui> blocks (JSON dashboards/grids) ────────────────────────────
  const uiRegex = /<ui>([\s\S]*?)<\/ui>/i;
  const match = cleanText.match(uiRegex);

  if (match) {
    try {
      let rawJson = match[1].trim();
      rawJson = rawJson.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      uiPayload = JSON.parse(rawJson);
      cleanText = cleanText.replace(uiRegex, '').trim();
    } catch (e) {
      console.error('[Generative UI] Failed to parse JSON payload:', e, match[1]);
    }
  }

  return { cleanText, uiPayload, artifactPayload };
}
