// Iris Desk Voice — AssemblyAI Voice Agent browser client.
//
// Flow: session-config + voice-token from server → WebSocket → PCM mic up, audio down.
// Client tool get_seat_link highlights Plumb seat cards and returns Stripe URLs.

const SAMPLE_RATE = 24_000;
const WS_URL = "wss://agents.assemblyai.com/v1/ws";

const els = {
  connect: document.getElementById("connect"),
  disconnect: document.getElementById("disconnect"),
  reconnect: document.getElementById("reconnect"),
  mute: document.getElementById("mute"),
  clear: document.getElementById("clear"),
  voice: document.getElementById("voice"),
  transcript: document.getElementById("transcript"),
  empty: document.getElementById("empty"),
  statusDot: document.getElementById("status-dot"),
  statusText: document.getElementById("status-text"),
  seatsGrid: document.getElementById("seats-grid"),
  seatsTagline: document.getElementById("seats-tagline"),
  pitchList: document.getElementById("pitch-list"),
  galleryNote: document.getElementById("gallery-note"),
  creditNote: document.getElementById("credit-note"),
  plumbLink: document.getElementById("plumb-link"),
  supportLink: document.getElementById("support-link"),
  finePrint: document.getElementById("fine-print"),
};

let sessionConfig = null;
let seatsById = {};
let ws = null;
let audioCtx = null;
let micStream = null;
let workletNode = null;
let micSource = null;
let playbackTime = 0;
let scheduledSources = [];
let userPartialEl = null;
let agentPartialEl = null;
let isMuted = false;
let isConnected = false;
let pendingToolResults = [];
let lastEventType = null;
let highlightTimer = null;

function setStatus(state, text) {
  els.statusDot.className = "dot " + state;
  els.statusText.textContent = text;
}

function clearTranscript() {
  els.transcript.innerHTML = "";
  els.transcript.appendChild(els.empty);
  userPartialEl = null;
  agentPartialEl = null;
}

function ensureBubble(role, partial = false) {
  if (els.empty.parentNode) els.empty.remove();
  const div = document.createElement("div");
  div.className = "bubble " + role + (partial ? " partial" : "");
  els.transcript.appendChild(div);
  els.transcript.scrollTop = els.transcript.scrollHeight;
  return div;
}

function addBubble(role, text, meta) {
  const div = ensureBubble(role);
  div.textContent = text;
  if (meta) {
    const span = document.createElement("span");
    span.className = "meta";
    span.textContent = meta;
    div.appendChild(span);
  }
  els.transcript.scrollTop = els.transcript.scrollHeight;
  return div;
}

const PITCH_ORDER = ["telegram", "delivery", "sla", "no_gratis"];
const PITCH_LABELS = {
  telegram: "Telegram control",
  delivery: "We build · you continue",
  sla: "3.35h delivery",
  no_gratis: "Paid seats",
};

function renderPitchList(pitch) {
  if (!pitch || !els.pitchList) return;
  els.pitchList.innerHTML = "";
  for (const key of PITCH_ORDER) {
    if (!pitch[key]) continue;
    const li = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = PITCH_LABELS[key];
    li.append(title, document.createTextNode(pitch[key]));
    els.pitchList.appendChild(li);
  }
}

function renderSeatCards(seatsConfig) {
  if (!seatsConfig?.seats?.length) return;

  els.seatsTagline.textContent = seatsConfig.tagline || els.seatsTagline.textContent;
  els.creditNote.textContent = seatsConfig.credit_note || els.creditNote.textContent;
  if (seatsConfig.gallery_note && els.galleryNote) {
    els.galleryNote.textContent = seatsConfig.gallery_note;
  }
  renderPitchList(seatsConfig.pitch);
  if (seatsConfig.fine_print && els.finePrint) {
    els.finePrint.textContent = seatsConfig.fine_print;
  }

  if (seatsConfig.product_url) {
    els.plumbLink.href = seatsConfig.product_url;
  }
  if (seatsConfig.support_email) {
    els.supportLink.href = "mailto:" + seatsConfig.support_email;
    els.supportLink.textContent = seatsConfig.support_email;
  }

  seatsById = {};
  els.seatsGrid.innerHTML = "";

  for (const seat of seatsConfig.seats) {
    seatsById[seat.id] = seat;

    const card = document.createElement("article");
    card.className = "seat-card";
    card.id = "seat-" + seat.id;
    card.dataset.tier = seat.id;

    const tier = document.createElement("h3");
    tier.className = "tier";
    tier.textContent = seat.name;

    const price = document.createElement("p");
    price.className = "price";
    price.textContent = "$" + seat.price_usd.toLocaleString("en-US");

    const summary = document.createElement("p");
    summary.className = "summary";
    summary.textContent = seat.summary;

    const sla = document.createElement("p");
    sla.className = "seat-sla";
    sla.textContent =
      seatsConfig.delivery_sla ||
      "Ready bot within 3.35 hours after payment — lucky-35 desk SLA.";

    const pay = document.createElement("a");
    pay.className = "pay-btn";
    pay.href = seat.payment_url;
    pay.target = "_blank";
    pay.rel = "noopener noreferrer";
    pay.textContent = "Purchase · $" + seat.price_usd.toLocaleString("en-US");

    card.append(tier, price, summary, sla, pay);
    els.seatsGrid.appendChild(card);
  }
}

function highlightSeat(tierId) {
  const id = String(tierId || "").toLowerCase();
  const card = document.getElementById("seat-" + id);
  if (!card) return;

  document.querySelectorAll(".seat-card.highlight").forEach((el) => {
    el.classList.remove("highlight");
  });

  card.classList.add("highlight");
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });

  if (highlightTimer) clearTimeout(highlightTimer);
  highlightTimer = setTimeout(() => {
    card.classList.remove("highlight");
  }, 8000);
}

function detectTierInText(text) {
  const lower = text.toLowerCase();
  if (/\bstarter\b/.test(lower)) return "starter";
  if (/\bsource\b/.test(lower)) return "source";
  if (/\bpro\b/.test(lower)) return "pro";
  return null;
}

function maybeHighlightFromAgentText(text) {
  if (!text) return;
  const lower = text.toLowerCase();
  const mentionsPay =
    lower.includes("pay link") ||
    lower.includes("on your screen") ||
    lower.includes("highlight");
  if (!mentionsPay) return;

  const tier = detectTierInText(lower);
  if (tier) highlightSeat(tier);
}

function getSeatLink(tier) {
  const id = String(tier || "").toLowerCase();
  const seat = seatsById[id];
  if (!seat) {
    return {
      ok: false,
      error: "Unknown tier. Use starter, pro, or source.",
      available: Object.keys(seatsById),
    };
  }

  highlightSeat(id);

  return {
    ok: true,
    tier: id,
    name: seat.name,
    price_usd: seat.price_usd,
    payment_url: seat.payment_url,
    message: "Pay link shown on screen for " + seat.name + ".",
  };
}

function flushPendingToolResults() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    pendingToolResults = [];
    return;
  }
  for (const item of pendingToolResults) {
    ws.send(
      JSON.stringify({
        type: "tool.result",
        call_id: item.call_id,
        result: JSON.stringify(item.result),
      }),
    );
  }
  pendingToolResults = [];
}

function queueToolResult(callId, result) {
  pendingToolResults.push({ call_id: callId, result });
  if (lastEventType === "reply.done") {
    flushPendingToolResults();
  }
}

async function fetchSessionConfig() {
  const res = await fetch("/api/session-config");
  if (!res.ok) throw new Error("Failed to load session config: " + res.status);
  return res.json();
}

async function fetchToken() {
  const res = await fetch("/api/voice-token");
  if (!res.ok) throw new Error("Failed to fetch token: " + res.status);
  const { token } = await res.json();
  return token;
}

function updateConnectionControls(connected) {
  isConnected = connected;
  els.connect.disabled = connected;
  els.disconnect.disabled = !connected;
  els.reconnect.disabled = !connected;
  els.mute.disabled = !connected;
  els.voice.disabled = connected;
}

function setMuted(muted) {
  isMuted = muted;
  if (micStream) {
    micStream.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }
  els.mute.textContent = muted ? "Unmute mic" : "Mute mic";
  els.mute.classList.toggle("active", muted);
  if (isConnected) {
    setStatus(muted ? "muted" : "connected", muted ? "Connected (mic muted)" : "Connected");
  }
}

async function connect() {
  els.connect.disabled = true;
  setStatus("connecting", "Loading desk policy…");

  try {
    sessionConfig = await fetchSessionConfig();
    renderSeatCards(sessionConfig.seats);
  } catch (err) {
    console.error(err);
    setStatus("error", "Config error");
    els.connect.disabled = false;
    return;
  }

  setStatus("connecting", "Requesting token…");

  let token;
  try {
    token = await fetchToken();
  } catch (err) {
    console.error(err);
    setStatus("error", "Token error");
    els.connect.disabled = false;
    return;
  }

  if (audioCtx) {
    try {
      audioCtx.close();
    } catch (_) {}
  }

  audioCtx = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: SAMPLE_RATE,
  });
  playbackTime = audioCtx.currentTime;
  scheduledSources = [];
  pendingToolResults = [];
  lastEventType = null;

  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
  } catch (err) {
    console.error("Mic permission denied:", err);
    setStatus("error", "Mic blocked");
    els.connect.disabled = false;
    return;
  }

  setMuted(false);

  await audioCtx.audioWorklet.addModule("pcm-processor.js");
  micSource = audioCtx.createMediaStreamSource(micStream);
  workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");

  setStatus("connecting", "Connecting…");
  ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        type: "session.update",
        session: {
          system_prompt: sessionConfig.system_prompt,
          greeting: sessionConfig.greeting,
          tools: sessionConfig.tools || [],
          output: { voice: els.voice.value },
        },
      }),
    );
  };

  ws.onmessage = (evt) => handleEvent(JSON.parse(evt.data));

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
    setStatus("error", "Connection error");
  };

  ws.onclose = (evt) => {
    console.log("WebSocket closed:", evt.code, evt.reason);
    teardown(false);
  };

  workletNode.port.onmessage = (e) => {
    if (!ws || ws.readyState !== WebSocket.OPEN || isMuted) return;
    const audio = arrayBufferToBase64(e.data);
    ws.send(JSON.stringify({ type: "input.audio", audio }));
  };
}

function handleEvent(event) {
  lastEventType = event.type;

  switch (event.type) {
    case "session.ready":
      setStatus("connected", "Connected");
      updateConnectionControls(true);
      micSource.connect(workletNode);
      break;

    case "transcript.user.delta":
      if (!userPartialEl) userPartialEl = ensureBubble("user", true);
      userPartialEl.textContent = event.text;
      els.transcript.scrollTop = els.transcript.scrollHeight;
      break;

    case "transcript.user":
      if (userPartialEl) {
        userPartialEl.classList.remove("partial");
        userPartialEl.textContent = event.text;
        userPartialEl = null;
      } else {
        addBubble("user", event.text);
      }
      break;

    case "reply.audio":
      playPCM(event.data);
      break;

    case "transcript.agent.delta":
      if (!agentPartialEl) agentPartialEl = ensureBubble("agent", true);
      agentPartialEl.textContent = event.text;
      els.transcript.scrollTop = els.transcript.scrollHeight;
      break;

    case "transcript.agent": {
      if (agentPartialEl) {
        agentPartialEl.classList.remove("partial");
        agentPartialEl.textContent = event.text;
        agentPartialEl = null;
      } else {
        addBubble("agent", event.text);
      }
      maybeHighlightFromAgentText(event.text);
      const meta = event.interrupted ? "interrupted" : null;
      if (meta) {
        const bubbles = els.transcript.querySelectorAll(".bubble.agent");
        const last = bubbles[bubbles.length - 1];
        if (last && !last.querySelector(".meta")) {
          const span = document.createElement("span");
          span.className = "meta";
          span.textContent = meta;
          last.appendChild(span);
        }
      }
      break;
    }

    case "tool.call": {
      if (event.name === "get_seat_link") {
        const tier = event.arguments?.tier;
        const result = getSeatLink(tier);
        queueToolResult(event.call_id, result);
      } else {
        queueToolResult(event.call_id, {
          ok: false,
          error: "Unknown tool: " + event.name,
        });
      }
      break;
    }

    case "reply.done":
      flushPendingToolResults();
      if (event.status === "interrupted") flushPlayback();
      break;

    case "session.error":
      console.error("Session error:", event);
      setStatus("error", `${event.code}: ${event.message}`);
      break;
  }
}

function playPCM(b64) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const int16 = new Int16Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / 2,
  );
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000;

  const buffer = audioCtx.createBuffer(1, float32.length, SAMPLE_RATE);
  buffer.getChannelData(0).set(float32);

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  if (playbackTime < now) playbackTime = now;
  source.start(playbackTime);
  playbackTime += buffer.duration;

  scheduledSources.push(source);
  source.onended = () => {
    scheduledSources = scheduledSources.filter((s) => s !== source);
  };
}

function flushPlayback() {
  for (const src of scheduledSources) {
    try {
      src.stop();
    } catch (_) {}
  }
  scheduledSources = [];
  playbackTime = audioCtx.currentTime;
}

function teardown(resetReconnect = true) {
  try {
    workletNode && workletNode.disconnect();
  } catch (_) {}
  try {
    micSource && micSource.disconnect();
  } catch (_) {}
  try {
    micStream && micStream.getTracks().forEach((t) => t.stop());
  } catch (_) {}
  try {
    audioCtx && audioCtx.close();
  } catch (_) {}
  ws = null;
  audioCtx = null;
  micStream = null;
  workletNode = null;
  micSource = null;
  scheduledSources = [];
  userPartialEl = null;
  agentPartialEl = null;
  pendingToolResults = [];
  lastEventType = null;
  isMuted = false;
  els.mute.textContent = "Mute mic";
  els.mute.classList.remove("active");
  setStatus("", "Disconnected");
  updateConnectionControls(false);
  if (resetReconnect) {
    els.reconnect.disabled = true;
  }
}

function disconnect() {
  if (ws && ws.readyState === WebSocket.OPEN) ws.close();
  else teardown();
}

async function reconnect() {
  disconnect();
  await new Promise((r) => setTimeout(r, 300));
  await connect();
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Pre-load seat cards before first connect so Pay buttons are always visible.
fetchSessionConfig()
  .then((cfg) => renderSeatCards(cfg.seats))
  .catch((err) => console.warn("Seat catalog preload failed:", err));

els.connect.addEventListener("click", connect);
els.disconnect.addEventListener("click", disconnect);
els.reconnect.addEventListener("click", reconnect);
els.mute.addEventListener("click", () => setMuted(!isMuted));
els.clear.addEventListener("click", clearTranscript);
