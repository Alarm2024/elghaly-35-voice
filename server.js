// Iris Desk Voice — lightweight Node server.
//
// 1. Serves static frontend in /public.
// 2. Issues single-use AssemblyAI tokens at GET /api/voice-token (key stays server-side).
// 3. Serves locked session config + desk link catalog at GET /api/session-config.
// 4. Health check at GET /api/health.

import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "dotenv/config";

const API_KEY = process.env.ASSEMBLYAI_API_KEY;
if (!API_KEY) {
  console.error(
    "Missing ASSEMBLYAI_API_KEY. Copy .env.example to .env and add your AssemblyAI key.",
  );
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const TOKEN_TTL_SECONDS = 300;

const GREETING =
  "Hello. I'm Iris Desk Voice, the front desk for the Iris page. I can explain the phone check, help you read what a transaction signed, or point you to support. How may I help?";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT = readFileSync(join(__dirname, "system-prompt.txt"), "utf8").trim();
const DESK_CONFIG = JSON.parse(readFileSync(join(__dirname, "desk.json"), "utf8"));

const SHOW_LINK_TOOL = {
  type: "function",
  name: "show_link",
  description:
    "Highlight a desk link card on the visitor's screen and return its URL. Call this when the visitor's question matches a topic so they can open it themselves.",
  parameters: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        enum: DESK_CONFIG.links.map((l) => l.id),
        description:
          "phone_check (iPhone/Android checklist), chain_read (what a transaction signed), iris_page (the Iris page), or support (email a human).",
      },
    },
    required: ["topic"],
  },
  execution_mode: "interactive",
  timeout_seconds: 30,
};

const app = express();

app.use(express.static(join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, links: DESK_CONFIG.links.length });
});

app.get("/api/session-config", (_req, res) => {
  res.json({
    system_prompt: SYSTEM_PROMPT,
    greeting: GREETING,
    desk: DESK_CONFIG,
    tools: [SHOW_LINK_TOOL],
  });
});

app.get("/api/voice-token", async (_req, res) => {
  try {
    const url = new URL("https://agents.assemblyai.com/v1/token");
    url.searchParams.set("expires_in_seconds", String(TOKEN_TTL_SECONDS));

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Token request failed: ${response.status} ${body}`);
      return res.status(502).json({ error: "Failed to get token" });
    }

    const { token } = await response.json();
    res.json({ token, expires_in_seconds: TOKEN_TTL_SECONDS });
  } catch (err) {
    console.error("Token request error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Iris Desk Voice running at http://localhost:${PORT}`);
});
