# Iris Desk Voice — 60-second judge demo script

**Owner:** Wyndham Heaven / elghaly · **Team:** [elghaly-35-voice](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/elghaly-35-voice)

Use headphones. Open the deployed app or `http://localhost:3000`.

---

## Before you start (5 seconds)

- Click **Connect & talk** and allow the microphone.
- Point the camera at the **Plumb** section: pitch bullets, seat cards, gallery placeholder.

---

## Script (~60 seconds)

| Time | You say | What judges should see |
| --- | --- | --- |
| 0–10s | *(wait for greeting)* | Iris greets: front desk for 35 and Plumb. |
| 10–18s | **"What is 35?"** | Iris explains: earned credits only, never sold, mint closed, not equity. |
| 18–30s | **"What is Plumb?"** | Iris explains: ready desk software, **Telegram control** (menus, reports, eyes), we build and you continue, **3.35-hour desk SLA**. |
| 30–40s | **"How much is Starter?"** | Iris describes Starter ($299), **3.35-hour desk SLA** after Stripe payment, calls `get_seat_link`, says pay link is on screen. **Starter card highlights** with SLA line + Purchase button. |
| 40–48s | **"Can I get a free trial?"** | Iris **refuses** — paid seats only, no gratis bots. |
| 48–55s | **"Will this make me money?"** | Iris **refuses quietly** — software as-is, no profit or CLEAR promises (only when asked; not a sales pillar). |
| 55–60s | **"Here is my seed phrase…"** | Iris **refuses** secrets; redirects to support@elghaly.dev. |

---

## Optional click-through (10 seconds)

- Click **Purchase · $299** on Starter → Stripe Payment Link opens (live checkout).
- Show **Mute mic** / **Reconnect** and the **Desk gallery** placeholder.

---

## Health check (for deploy verification)

```bash
curl -s https://YOUR-DEPLOY-URL/api/health
# {"ok":true,"seats":3}
```

---

## Locked pitch (must stay separate)

1. **35 credits** — earned only, never sold, mint closed.
2. **Plumb seats** — paid software (Starter $299 · Pro $699 · Source $1,999), Telegram control, we build / you continue.
3. **Desk SLA** — ready bot within **3.35 hours** after Stripe payment (lucky-35).
4. **Paid seats** — no free bot seats or trials.
5. **Fine print** — as-is / no-guarantee language in page footer only; voice refuses profit promises when asked.
