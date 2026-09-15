✝️🧿🪬

3️⃣🧿5️⃣

# Iris Desk Voice

Real-time voice desk assistant for visitors of [iris-35.elghaly.dev](https://iris-35.elghaly.dev/), [35.elghaly.dev](https://35.elghaly.dev/), and [Plumb](https://github.com/Alarm2024/plumb35) desk software. Built for the [AssemblyAI Voice Agent Hackathon](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon) — LabLab team **[elghaly-35-voice](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/elghaly-35-voice)**.

**Deadline:** Sep 30, 2026 · **Public byline:** Wyndham Heaven / elghaly

---

## What it does

**Iris Desk Voice** speaks as a calm front-desk assistant for the **35 / Iris** brand and **Plumb** seats:

### Two doors (never mixed)

1. **35 credits** — earned only, never sold, no deposits, not equity. Mint closed until desk PnL.
2. **Plumb seats** — paid ready desk hunt software you self-host (Starter / Pro / Source). **Telegram control** — menus, reports, eyes. **We build; you continue** — elghaly delivers bot + walkthrough; buyer operates after. **Desk SLA:** ready bot within **3.35 hours** after Stripe payment (lucky-35). Paid seats only — no free trials. Titan/gRPC quoted separately after brief. As-is / no-guarantee terms live in the page footer fine print only.

### Voice + checkout

- Explains 35, SIGHT, Iris FAQs, and Plumb seat tiers in plain English
- **Sales mode:** when asked about price / buy / ready bot / Plumb — explains tier and highlights the matching **Stripe Payment Link** on screen
- Three **Pay** cards on the page (no Stripe.js secrets in repo):
  - [Starter $299](https://buy.stripe.com/14A6oB4AD7GBd2g3QN3Ru00)
  - [Pro $699](https://buy.stripe.com/4gM00d4AD2mhfao1IF3Ru01)
  - [Source $1,999](https://buy.stripe.com/5kQ5kx4AD2mh2nC0EB3Ru02)
- Client tool `get_seat_link(tier)` returns the URL and pulses the seat card
- Soft support: [support@elghaly.dev](mailto:support@elghaly.dev)

**Hard refusals (locked in `system-prompt.txt`):** never asks for seeds, private keys, or API secrets; never claims mint is live; never sells 35 credits; never gives trading advice or CLEAR+/go signals; never promises guaranteed profit.

No wallets, seeds, mint logic, or bot keys in this repo — voice + Payment Links only.

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

Open **http://localhost:3000**, click **Connect & talk**, allow the mic, and speak. Pay buttons are always visible — ask Iris about Starter, Pro, or Source to highlight a card.

**Tip:** Use headphones during development so the agent does not hear its own voice through speakers.

---

## Judge demo (60s)

See **[DEMO.md](./DEMO.md)** for the full script: greet → what is 35 → what is Plumb → refuse seed → show Starter Pay link.

---

## How it works

```
Browser                         Node server                    AssemblyAI
   │                                 │                              │
   │  GET /api/session-config        │                              │
   │────────────────────────────────>│  (prompt + seats.json)       │
   │  GET /api/voice-token           │                              │
   │────────────────────────────────>│  GET agents.assemblyai.com   │
   │                                 │  /v1/token (API key)         │
   │  WebSocket + temp token         │                              │
   │────────────────────────────────────────────────────────────────>│
   │  PCM 24 kHz mono ↑  ·  reply audio + transcripts ↓            │
   │  tool.call get_seat_link → highlight card + tool.result       │
```

| Piece | Role |
| --- | --- |
| `server.js` | Static UI, token mint, session config, `/api/health` |
| `system-prompt.txt` | Desk policy + sales mode — refusal rules not editable in browser |
| `seats.json` | Public-safe Plumb tiers, prices, Stripe Payment Links (single source) |
| `public/app.js` | WebSocket client, `get_seat_link` tool, seat highlight, mute/reconnect |
| `public/pcm-processor.js` | Float32 → Int16 PCM at 24 kHz |

Follows the [AssemblyAI Voice Agent tutorial](https://www.assemblyai.com/blog/build-a-voice-assistant-app-with-voice-agent-api): one WebSocket to `wss://agents.assemblyai.com/v1/ws`, API key only on the server.

---

## Project layout

```
├── server.js              # Express: static + token + session config + health
├── system-prompt.txt      # Locked Iris Desk policy (edit in repo only)
├── seats.json             # Plumb seat catalog (Stripe Payment Links)
├── DEMO.md                # 60s judge demo script
├── Dockerfile             # One-click container deploy
├── render.yaml            # Render Blueprint
├── fly.toml               # Fly.io config
├── public/
│   ├── index.html         # Iris-branded UI + Plumb seat cards
│   ├── app.js             # Voice Agent WebSocket client + tools
│   └── pcm-processor.js   # AudioWorklet PCM encoder
├── .env.example           # ASSEMBLYAI_API_KEY= only (+ optional PORT)
└── package.json
```

---

## Hackathon submit checklist

- [x] Repo is public and linked from [LabLab team page](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/elghaly-35-voice)
- [x] Uses **AssemblyAI Voice Agent API** (token mint + WebSocket streaming + client tool)
- [x] `npm start` works after `cp .env.example .env` + valid API key
- [x] README explains what, how, team link, and two-door product truth
- [x] **Plumb seat checkout** — Stripe Payment Links on page + voice sales mode
- [x] **DEMO.md** — 60s judge script
- [x] **GET /api/health** → `{ "ok": true, "seats": 3 }`
- [x] No secrets committed — only `.env.example` with empty key placeholder
- [ ] Demo video or live URL (optional but recommended for judges)

---

## Deploy (one-click friendly)

The app is a single Node process (`npm start`). Only `ASSEMBLYAI_API_KEY` is required.

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
| `ASSEMBLYAI_API_KEY` | Yes | Server-only AssemblyAI key for token minting |
| `PORT` | No | HTTP port (default `3000`) |

---

## License

Hackathon submission for LabLab AssemblyAI Voice Agent Hackathon, team elghaly-35-voice.
