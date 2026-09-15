✝️🧿🪬

3️⃣🧿5️⃣

# Iris Desk Voice

Real-time voice desk assistant for visitors of [iris-35.elghaly.dev](https://iris-35.elghaly.dev/) and [35.elghaly.dev](https://35.elghaly.dev/). Built for the [AssemblyAI Voice Agent Hackathon](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon) — LabLab team **[elghaly-35-voice](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/elghaly-35-voice)**.

**Deadline:** Sep 30, 2026 · **Public byline:** Wyndham Heaven / elghaly

---

## What it does

**Iris Desk Voice** speaks as a calm front-desk assistant for the **35 / Iris** brand:

- Explains **35 = earned credits only** (never sold, no deposits, not equity)
- Points visitors to **SIGHT** (public Solana signature classify) and the [Iris page](https://iris-35.elghaly.dev/)
- Answers FAQs: mint closed until desk PnL; no bot hot keys; Squads vault = treasury
- Soft support door: [support@elghaly.dev](mailto:support@elghaly.dev) · [iris-35.elghaly.dev](https://iris-35.elghaly.dev/)

**Hard refusals (locked in `system-prompt.txt`):** never asks for seeds, private keys, or API secrets; never claims mint is live; never gives trading advice or CLEAR+/go signals.

No wallets, seeds, mint logic, or bot keys in this repo — voice demo only.

---

## Quick start (5 minutes)

### Prerequisites

- **Node.js 18+**
- **AssemblyAI API key** — [sign up free](https://www.assemblyai.com/dashboard/signup)
- A modern browser with microphone (Chrome, Firefox, Safari 14.1+)

### Run locally

```bash
git clone https://github.com/Alarm2024/elghaly-35-voice.git
cd elghaly-35-voice
npm install
cp .env.example .env
# Edit .env and set ASSEMBLYAI_API_KEY=your_key_here
npm start
```

Open **http://localhost:3000**, click **Connect & talk**, allow the mic, and speak.

**Tip:** Use headphones during development so the agent does not hear its own voice through speakers.

---

## How it works

```
Browser                         Node server                    AssemblyAI
   │                                 │                              │
   │  GET /api/session-config        │                              │
   │────────────────────────────────>│  (locked system prompt)      │
   │  GET /api/voice-token           │                              │
   │────────────────────────────────>│  GET agents.assemblyai.com   │
   │                                 │  /v1/token (API key)         │
   │  WebSocket + temp token         │                              │
   │────────────────────────────────────────────────────────────────>│
   │  PCM 24 kHz mono ↑  ·  reply audio + transcripts ↓            │
```

| Piece | Role |
| --- | --- |
| `server.js` | Serves static UI, mints short-lived tokens, exposes locked session config |
| `system-prompt.txt` | Desk policy — refusal rules are not editable in the browser |
| `public/app.js` | WebSocket client, AudioWorklet mic capture, playback scheduling, barge-in |
| `public/pcm-processor.js` | Float32 → Int16 PCM at 24 kHz |

Follows the [AssemblyAI Voice Agent tutorial](https://www.assemblyai.com/blog/build-a-voice-assistant-app-with-voice-agent-api): one WebSocket to `wss://agents.assemblyai.com/v1/ws`, API key only on the server.

---

## Project layout

```
├── server.js              # Express: static files + token + session config
├── system-prompt.txt        # Locked Iris Desk policy (edit in repo only)
├── public/
│   ├── index.html         # Iris-branded UI
│   ├── app.js             # Voice Agent WebSocket client
│   └── pcm-processor.js   # AudioWorklet PCM encoder
├── .env.example           # ASSEMBLYAI_API_KEY= only
└── package.json
```

---

## Hackathon submit checklist

- [ ] Repo is public and linked from [LabLab team page](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/elghaly-35-voice)
- [ ] Uses **AssemblyAI Voice Agent API** (token mint + WebSocket streaming)
- [ ] `npm start` works after `cp .env.example .env` + valid API key
- [ ] README explains what, how, and team link (this file)
- [ ] No secrets committed — only `.env.example` with empty key placeholder
- [ ] Demo video or live URL (optional but recommended for judges)

---

## Deploy notes (optional, free-tier friendly)

The app is a single Node process (`npm start`). The browser talks directly to AssemblyAI over WebSocket; only the token endpoint needs your server.

### Fly.io

```bash
fly launch --name iris-desk-voice --internal-port 3000
fly secrets set ASSEMBLYAI_API_KEY=your_key_here
fly deploy
```

Set `PORT=3000` (Fly sets this automatically). Serve over HTTPS for mic access on non-localhost origins.

### Render

1. New **Web Service** → connect this repo
2. Build: `npm install` · Start: `npm start`
3. Add env var `ASSEMBLYAI_API_KEY`
4. Free tier spins down after inactivity — first visit may take ~30s

### Vercel

Vercel is static-first; this Express app fits better on Fly or Render. If you must use Vercel, split `/api/voice-token` into a serverless function and host `public/` as static files — or proxy to a small Fly/Render backend for tokens only.

---

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `ASSEMBLYAI_API_KEY` | Yes | Server-only AssemblyAI key for token minting |
| `PORT` | No | HTTP port (default `3000`) |

---

## License

Hackathon submission for LabLab AssemblyAI Voice Agent Hackathon, team elghaly-35-voice.
