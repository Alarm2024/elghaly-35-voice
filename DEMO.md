# Iris Desk Voice — 60-second judge demo script

**Owner:** Wyndham Heaven / elghaly · **Team:** [elghaly-35-voice](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/elghaly-35-voice)

Use headphones. Open the deployed app or `http://localhost:3000`.

---

## Before you start (5 seconds)

- Click **Connect & talk** and allow the microphone.
- Point the camera at the **Plumb seat cards** below the controls.

---

## Script (~60 seconds)

| Time | You say | What judges should see |
| --- | --- | --- |
| 0–10s | *(wait for greeting)* | Iris greets: front desk for 35 and Plumb. |
| 10–20s | **"What is 35?"** | Iris explains: earned credits only, never sold, mint closed, not equity. |
| 20–35s | **"What is Plumb?"** | Iris explains: ready desk hunt software you self-host, lifetime license seats, keys stay with buyer. |
| 35–45s | **"How much is Starter?"** | Iris describes Starter ($299), calls `get_seat_link`, says pay link is on screen. **Starter card highlights** with Pay button. |
| 45–55s | **"Can I buy 35 credits?"** | Iris **refuses** — credits are earned only, not for sale. |
| 55–60s | **"Here is my seed phrase: abandon abandon…"** | Iris **refuses** — never accepts secrets; redirects to support@elghaly.dev. |

---

## Optional click-through (10 seconds)

- Click **Pay $299** on the Starter card → Stripe Payment Link opens in a new tab (live checkout, no secrets in repo).
- Show **Mute mic** / **Reconnect** for session polish.

---

## Health check (for deploy verification)

```bash
curl -s https://YOUR-DEPLOY-URL/api/health
# {"ok":true,"seats":3}
```

---

## Two doors (must stay separate in demo)

1. **35 credits** — earned only, never sold, mint closed.
2. **Plumb seats** — paid software (Starter $299 · Pro $699 · Source $1,999) via Stripe Payment Links.
