✝️🧿🪬

3️⃣🧿5️⃣

# Iris Desk Voice

Real-time voice front desk for the [Iris page](https://iris-35.elghaly.dev/), built on the **AssemblyAI Voice Agent API**. Built for the [AssemblyAI Voice Agent Hackathon](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon) — LabLab team **[elghaly-35-voice](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/elghaly-35-voice)**.

**Live demo:** https://iris-desk-voice.onrender.com (Render free plan; the first load after idle can take ~30–60 s)

**Deadline:** Sep 30, 2026 · **Public byline:** Wyndham Heaven / elghaly

---

## What it does

Visitors click **Connect & talk** and ask questions out loud. Iris answers in a calm voice and points them to the right place on screen.

- **Speech-to-speech in the browser** — live transcripts for both sides; when the visitor interrupts, the agent stops and the reply is marked *interrupted*.
- **Explains the Iris page** — the iPhone / Android phone check, the chain read (what a Solana, Bitcoin or Ethereum transaction actually signed), offline use and the six languages.
- **Client tool `show_link(topic)`** — when a question matches a topic (`phone_check`, `chain_read`, `iris_page`, `support`), the agent calls the tool and the matching card on the page is highlighted so the visitor can open it.
- **Hard refusals (locked in `system-prompt.txt`)** — never asks for or accepts seed phrases, private keys, passwords or API keys; no financial advice; no promises of outcomes; no payments. Redirects to [support@elghaly.dev](mailto:support@elghaly.dev).
- Mute mic, reconnect, clear transcript and a voice picker.

No wallets, seeds or keys in this repo — voice agent and public links.

---

## Quick start (5 minutes)

### Prerequisites

- **Node.js 18+**
- **AssemblyAI API key** — [sign up free](https://www.assemblyai.com/dashboard/signup)
- A modern browser with microphone (Chrome, Firefox, Safari 14.1+), desktop or phone

### Run locally

```bash
git clone https://github.com/Alarm2024/elghaly-35-voice.git
cd elghaly-35-voice
npm install
cp .env.example .env
# Edit .env and set ASSEMBLYAI_API_KEY=your_key_here
npm start
```

Open **http://localhost:3000**, click **Connect & talk**, allow the mic, and speak. Ask about the phone check or reading a transaction to see a card highlight.

**Tip:** Use headphones during development so the agent does not hear its own voice through speakers.

---

## Judge demo (60s)

See **[DEMO.md](./DEMO.md)** for the full script: greet → phone check (card highlights) → chain read → interrupt → refuse a seed phrase → mute / reconnect.

---

## How it works

```
Browser                         Node server                    AssemblyAI
   │                                 │                              │
   │  GET /api/session-config        │                              │
   │────────────────────────────────>│  (prompt + desk.json + tool) │
   │  GET /api/voice-token           │                              │
   │────────────────────────────────>│  GET agents.assemblyai.com   │
   │                                 │  /v1/token (API key)         │
   │  WebSocket + temp token         │                              │
   │────────────────────────────────────────────────────────────────>│
   │  PCM 24 kHz mono ↑  ·  reply audio + transcripts ↓            │
   │  tool.call show_link → highlight card + tool.result           │
```

| Piece | Role |
| --- | --- |
| `server.js` | Static UI, short-lived token, session config, `/api/health` |
| `system-prompt.txt` | Desk policy and refusal rules — not editable in the browser |
| `desk.json` | Link cards the agent can highlight (single source for UI and tool enum) |
| `public/app.js` | WebSocket client, `show_link` tool, card highlight, mute/reconnect |
| `public/pcm-processor.js` | Float32 → Int16 PCM at 24 kHz |

Follows the [AssemblyAI Voice Agent tutorial](https://www.assemblyai.com/blog/build-a-voice-assistant-app-with-voice-agent-api): one WebSocket to `wss://agents.assemblyai.com/v1/ws`, API key kept on the server.

---

## Project layout

```
├── server.js              # Express: static + token + session config + health
├── system-prompt.txt      # Locked Iris desk policy (edit in repo)
├── desk.json              # Link cards + show_link topics
├── DEMO.md                # 60s judge demo script
├── Dockerfile             # One-click container deploy
├── render.yaml            # Render Blueprint
├── fly.toml               # Fly.io config
├── public/
│   ├── index.html         # Iris-branded UI + link cards
│   ├── app.js             # Voice Agent WebSocket client + tools
│   └── pcm-processor.js   # AudioWorklet PCM encoder
├── .env.example           # ASSEMBLYAI_API_KEY= (+ optional PORT)
└── package.json
```

---

## Hackathon submit checklist

- [x] Repo is public and linked from [LabLab team page](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/elghaly-35-voice)
- [x] Uses **AssemblyAI Voice Agent API** (token + WebSocket streaming + client tool)
- [x] `npm start` works after `cp .env.example .env` + valid API key
- [x] **DEMO.md** — 60s judge script
- [x] **GET /api/health** → `{ "ok": true, "links": 4 }`
- [x] No secrets committed — `.env.example` has an empty key placeholder
- [x] MIT license
- [x] Live URL — https://iris-desk-voice.onrender.com
- [ ] Demo video

---

## Deploy (one-click friendly)

The app is a single Node process (`npm start`). The one required variable is `ASSEMBLYAI_API_KEY`.

### Docker

```bash
docker build -t iris-desk-voice .
docker run -p 3000:3000 -e ASSEMBLYAI_API_KEY=your_key_here iris-desk-voice
curl http://localhost:3000/api/health
```

### Render

1. New **Web Service** → connect this repo (or use `render.yaml` Blueprint)
2. Build: `npm install` · Start: `npm start`
3. Add env var `ASSEMBLYAI_API_KEY`
4. Health check path: `/api/health`

### Fly.io

```bash
fly launch --name iris-desk-voice
fly secrets set ASSEMBLYAI_API_KEY=your_key_here
fly deploy
```

Serve over HTTPS for mic access on non-localhost origins.

---

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `ASSEMBLYAI_API_KEY` | Yes | AssemblyAI key, kept on the server and used to issue short-lived browser tokens |
| `PORT` | No | HTTP port (default `3000`) |

---

## License

[MIT](./LICENSE) © 2026 elghaly. Hackathon submission for LabLab AssemblyAI Voice Agent Hackathon, team elghaly-35-voice.
