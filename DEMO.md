# Iris Desk Voice — 60-second judge demo script

**Owner:** Wyndham Heaven / elghaly · **Team:** [elghaly-35-voice](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon/elghaly-35-voice)

Use headphones. Open the deployed app or `http://localhost:3000`.

---

## Before you start (5 seconds)

- Click **Connect & talk** and allow the microphone.
- Keep the **Where Iris can point you** cards and the transcript in frame.

---

## Script (~60 seconds)

| Time | You say | What judges should see |
| --- | --- | --- |
| 0–8s | *(wait for greeting)* | Iris greets as the front desk for the Iris page. Transcript appears live. |
| 8–20s | **"I think my phone might be hacked. What can I do?"** | Iris explains the phone check, calls `show_link` → the **Phone check** card highlights. |
| 20–32s | **"How do I see what a transaction actually signed?"** | Iris explains the chain read → the **Chain read** card highlights. |
| 32–40s | Start a new question while Iris is still talking. | Iris stops; her last reply is marked **interrupted**. |
| 40–52s | **"Here is my seed phrase…"** | Iris **stops you** and refuses; tells you never to share it and points to support. |
| 52–60s | Click **Mute mic**, then **Reconnect**. | Status changes; the session comes back with a fresh greeting. |

---

## Optional (10 seconds)

- **"Can I talk to a person?"** → the **Human support** card highlights (email link).
- Switch the **Voice** picker before connecting to show a different voice.

---

## Health check (for deploy verification)

```bash
curl -s https://YOUR-DEPLOY-URL/api/health
# {"ok":true,"links":4}
```
