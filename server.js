// Iris Desk Voice — lightweight Node server.
//
// 1. Serves static frontend in /public.
// 2. Mints single-use AssemblyAI tokens at GET /api/voice-token (key stays server-side).
// 3. Serves locked session config + Plumb seat catalog at GET /api/session-config.
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
  "Hello. I'm Iris Desk Voice — the front desk for 35 and Plumb. Ask about earned credits, desk software seats, or Iris. How may I help you?";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT = readFileSync(join(__dirname, "system-prompt.txt"), "utf8").trim();
const SEATS_CONFIG = JSON.parse(readFileSync(join(__dirname, "seats.json"), "utf8"));

const GET_SEAT_LINK_TOOL = {
  type: "function",
  name: "get_seat_link",
  description:
    "Return the Stripe Payment Link for a Plumb seat tier when the visitor wants to buy or asks about pricing. Call this when explaining Starter, Pro, or Source so the UI can highlight the Pay card.",
  parameters: {
    type: "object",
    properties: {
      tier: {
        type: "string",
        enum: ["starter", "pro", "source"],
        description: "Plumb seat tier: starter ($299), pro ($699), or source ($1999).",
      },
    },
    required: ["tier"],
  },
  execution_mode: "interactive",
  timeout_seconds: 30,
};

const app = express();

app.use(express.static(join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, seats: SEATS_CONFIG.seats.length });
});

app.get("/api/session-config", (_req, res) => {
  res.json({
    system_prompt: SYSTEM_PROMPT,
    greeting: GREETING,
    seats: SEATS_CONFIG,
    tools: [GET_SEAT_LINK_TOOL],
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
      console.error(`Token mint failed: ${response.status} ${body}`);
      return res.status(502).json({ error: "Failed to mint token" });
    }

    const { token } = await response.json();
    res.json({ token, expires_in_seconds: TOKEN_TTL_SECONDS });
  } catch (err) {
    console.error("Token mint error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Iris Desk Voice running at http://localhost:${PORT}`);
});
