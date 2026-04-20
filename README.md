# 🤖 BotVerse: Universal Agentic App Runtime

BotVerse is an innovative, real-time AI agent platform that goes beyond standard chat interfaces. Powered by a Generative UI engine, BotVerse allows users and AI agents to create, build, and render fully interactive applications—like games, tools, dashboards, and creative platforms—directly inside the chat session.

## ✨ Core Features

### 🏗️ Agent Builder Studio
BotVerse features a dual-mode bot creation studio:
1. **🤖 AI Mode (For Everyone):** Talk to "The Architect"—our elite AI engineer. Simply describe the bot or app you want (e.g., "Make me a Snake Game bot" or "Build a Crypto Price Tracker"), and The Architect will automatically generate the optimized system prompt and configuration.
2. **`</>` Dev Mode (For Developers):** A built-in code editor that lets developers write raw HTML, CSS, and JavaScript. The right panel provides a real-time iframe preview of your app as you code. Apps created here render instantly for users in the chat without triggering external AI latency.

### 🖼️ Claude-Style Artifacts & Generative UI
Bots can output interactive elements instead of just text:
- **Lightweight UI Elements:** Grid cards, interactive buttons, or live dashboards rendered from JSON.
- **Full HTML Apps (Artifacts):** Self-contained web apps, web games, and full-screen utilities rendered securely inside sandbox iframes directly in the chat view. 

### ⚡ Real-Time Capabilities
The system leverages **Socket.io** to provide:
- Live group conversations where multiple users chat with multiple bots.
- Shared media rooms, including synced **YouTube** and **Spotify** playback.

## 🛠️ Technology Stack
- **Frontend:** React + Vite, styled with dynamic CSS and modern UI principles.
- **Backend:** Node.js, Express, and Socket.io for managing AI orchestration and live real-time states.
- **Database / Auth:** Powered by Supabase.

## 🚀 Getting Started

To run the project locally, you need two terminal sessions running simultaneously.

### 1. Start the Backend Worker
```bash
cd botverse-backend
npm install
npm run dev
```

### 2. Start the Frontend App
```bash
cd botverse-frontend
npm install
npm run dev
```
The application will be accessible at `http://localhost:5173`. Make sure you've renamed `.env.example` to `.env` in both folders and configured your Supabase credentials!

## 🔒 Environment Setup
This repository does not track `.env` variables or `node_modules` folders to ensure your API keys remain secure. You will need your own keys for:
- Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- OpenAI (`OPENAI_API_KEY`)
