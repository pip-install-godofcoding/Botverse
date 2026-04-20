# BotVerse — Setup Guide

## Step 1: Get API Keys

### 1. LLM Provider (Choose ONE)

**Option A: Grok (xAI)**
1. Go to https://console.xai.com/
2. Sign in and create an API Key.
3. Paste into `.env` as `XAI_API_KEY`

**Option B: Sarvam AI**
1. Go to https://dashboard.sarvam.ai/
2. Sign in and generate an API key.
3. Paste into `.env` as `SARVAM_API_KEY`

### 2. YouTube Data API v3
1. Go to https://console.cloud.google.com
2. Create a new project (or use existing)
3. Search "YouTube Data API v3" → Enable
4. Go to Credentials → Create Credentials → API Key
5. (Optional) Restrict key to YouTube Data API v3
6. Copy the `AIza...` key

### 3. Spotify Web API
1. Go to https://developer.spotify.com/dashboard
2. Log in with your standard Spotify account (Premium is NOT required).
3. Click "Create App" → Give it a name and description.
   - For **Redirect URIs**, it's a required field in the form but we don't actually use it. To bypass the "not secure" error, just enter a secure dummy URL like `https://example.com` or `https://localhost:5173` and click Add.
   - Under "Which API/SDKs are you planning to use?", check the box for **Web API**.
   - Accept terms and click Save.
4. Go to the app's Settings → copy the **Client ID** and **Client Secret**.

### 4. Supabase (Database + Auth)
1. Go to https://supabase.com → New Project
2. Choose a region (e.g. South Asia)
3. Once created: Settings → API
4. Copy: Project URL and anon public key
5. Also copy the service_role key (for backend)
6. Go to Authentication → Providers → Google
7. Enable Google → paste your Google OAuth credentials
   - Get from: https://console.cloud.google.com → APIs → Credentials → OAuth 2.0 Client IDs
   - Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`

## Step 2: Configure Environment

### Backend
```bash
cd botverse-backend
copy .env.example .env
# Fill in your keys in .env
```

### Frontend
```bash
cd botverse-frontend
copy .env.example .env
# Fill in your Supabase URL and anon key
```

## Step 3: Set Up Database

1. Go to Supabase → SQL Editor
2. Open the file `botverse-backend/supabase_schema.sql`
3. Paste the entire contents and click Run

## Step 4: Run the App

### Terminal 1 — Backend
```bash
cd botverse-backend
npm run dev
# Should print: BotVerse backend running on http://localhost:3001
```

### Terminal 2 — Frontend
```bash
cd botverse-frontend
npm run dev
# Opens at http://localhost:5173
```

## Features Available

| Feature | Status | Requires |
|---------|--------|----------|
| Login with Google | ✅ | Supabase |
| Demo mode (no login) | ✅ | Nothing |
| Chat with Gojo/SRK/Einstein | ✅ | AI key (xAI / Sarvam) |
| Create custom bots | ✅ | Nothing (saves to Supabase if logged in) |
| YouTube search | ✅ | YouTube API key |
| YouTube Watch Together (sync) | ✅ | Backend running |
| Music search (Apple Music) | ✅ | Nothing (Zero Setup Cost) |
| Listen Together | ✅ | Backend running |
| Group chat (real-time) | ✅ | Backend running |
| Bot @mention in groups | ✅ | AI key (xAI / Sarvam) |
| Bot Marketplace | ✅ | Supabase |
| Shareable bot links | ✅ | Nothing |
| Study Buddy Bot | ✅ | AI key (xAI / Sarvam) |
| Presentation Builder | ✅ | AI key (xAI / Sarvam) |
| MoM Writer | ✅ | AI key (xAI / Sarvam) |

## Without Any Keys

You can still run the app in **demo mode** (click "Try without account"):
- Create bots locally (not persisted)
- YouTube rooms work (search won't work without API keys)
- Apple Music rooms work (100% free with no keys required)
- Real-time sync works within same browser (Socket.io still connects)
- AI replies won't work without an AI API key
// database password FINyCbvDfL0DaFpE