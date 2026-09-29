// Iris Desk Voice — AssemblyAI Voice Agent browser client.
//
// Flow: session-config + voice-token from server → WebSocket → PCM mic up, audio down.
// Client tool show_link highlights a desk link card and returns its URL.

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
  linksGrid: document.getElementById("links-grid"),
  linksTitle: document.getElementById("links-title"),
  linksIntro: document.getElementById("links-intro"),
  supportLink: document.getElementById("support-link"),
};

let sessionConfig = null;
let linksById = {};
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

function renderLinkCards(deskConfig) {
  if (!deskConfig?.links?.length) return;

  if (deskConfig.title) els.linksTitle.textContent = deskConfig.title;
  if (deskConfig.intro) els.linksIntro.textContent = deskConfig.intro;
  if (deskConfig.support_email) {
    els.supportLink.href = "mailto:" + deskConfig.support_email;
    els.supportLink.textContent = deskConfig.support_email;
  }

  linksById = {};
  els.linksGrid.innerHTML = "";

  for (const link of deskConfig.links) {
    linksById[link.id] = link;

    const card = document.createElement("article");
    card.className = "link-card";
    card.id = "link-" + link.id;
    card.dataset.topic = link.id;

    const name = document.createElement("h3");
    name.className = "link-name";
    name.textContent = link.name;

    const summary = document.createElement("p");
    summary.className = "summary";
    summary.textContent = link.summary;

    const open = document.createElement("a");
    open.className = "open-btn";
    open.href = link.url;
    if (!link.url.startsWith("mailto:")) {
      open.target = "_blank";
      open.rel = "noopener noreferrer";
    }
    open.textContent = link.label || "Open";

    card.append(name, summary, open);
    els.linksGrid.appendChild(card);
  }
}

function highlightCard(topicId) {
  const id = String(topicId || "").toLowerCase();
  const card = document.getElementById("link-" + id);
  if (!card) return;

  document.querySelectorAll(".link-card.highlight").forEach((el) => {
    el.classList.remove("highlight");
  });

  card.classList.add("highlight");
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });

  if (highlightTimer) clearTimeout(highlightTimer);
  highlightTimer = setTimeout(() => {
    card.classList.remove("highlight");
  }, 8000);
}

function showLink(topic) {
  const id = String(topic || "").toLowerCase();
  const link = linksById[id];
  if (!link) {
    return {
      ok: false,
      error: "Unknown topic.",
      available: Object.keys(linksById),
    };
  }

  highlightCard(id);

  return {
    ok: true,
    topic: id,
    name: link.name,
    url: link.url,
    message: link.name + " is highlighted on the visitor's screen.",
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

function micSupportError() {
  if (!window.isSecureContext) return "Mic needs HTTPS";
  if (!navigator.mediaDevices?.getUserMedia) return "Mic not supported in this browser";
  if (!window.AudioWorkletNode) return "Browser too old (no AudioWorklet)";
  return null;
}

async function connect() {
  const unsupported = micSupportError();
  if (unsupported) {
    setStatus("error", unsupported);
    return;
  }

  els.connect.disabled = true;

  // Create and resume the AudioContext synchronously inside the tap/click handler.
  // iOS Safari (and some Android browsers) keep a context created after an await
  // suspended, which silences playback and stops the mic worklet. Use the device's
  // native rate; pcm-processor.js resamples the mic to 24 kHz.
  if (audioCtx) audioCtx.close().catch(() => {});
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume().catch(() => {});

  setStatus("connecting", "Loading desk policy…");

  try {
    sessionConfig = await fetchSessionConfig();
    renderLinkCards(sessionConfig.desk);
  } catch (err) {
    console.error(err);
    setStatus("error", "Config error");
    failConnect();
    return;
  }

  setStatus("connecting", "Requesting token…");

  let token;
  try {
    token = await fetchToken();
  } catch (err) {
    console.error(err);
    setStatus("error", "Token error");
    failConnect();
    return;
  }

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
    setStatus("error", "Mic blocked — allow microphone and retry");
    failConnect();
    return;
  }

  setMuted(false);

  try {
    await audioCtx.audioWorklet.addModule("pcm-processor.js");
    micSource = audioCtx.createMediaStreamSource(micStream);
    workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");
    await audioCtx.resume();
  } catch (err) {
    console.error("Audio setup failed:", err);
    setStatus("error", "Audio setup failed");
    failConnect();
    return;
  }

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

  ws.onmessage = (evt) => {
    if (ws === thisWs) handleEvent(JSON.parse(evt.data));
  };

  const thisWs = ws;
  let sawError = false;
  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
    sawError = true;
  };

  ws.onclose = (evt) => {
    console.log("WebSocket closed:", evt.code, evt.reason);
    if (ws !== thisWs) return; // a newer session already replaced this one
    teardown(false);
    if (sawError || evt.code !== 1000) {
      setStatus("error", "Disconnected (" + evt.code + (evt.reason ? ": " + evt.reason : "") + ")");
    }
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
      if (event.name === "show_link") {
        const topic = event.arguments?.topic;
        const result = showLink(topic);
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
  if (!audioCtx) return;
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
  if (audioCtx) playbackTime = audioCtx.currentTime;
}

function failConnect() {
  try {
    micStream && micStream.getTracks().forEach((t) => t.stop());
  } catch (_) {}
  if (audioCtx) audioCtx.close().catch(() => {});
  audioCtx = null;
  micStream = null;
  els.connect.disabled = false;
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
  if (audioCtx) audioCtx.close().catch(() => {});
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
  if (ws && ws.readyState === WebSocket.OPEN) {
    const old = ws;
    teardown();
    old.close(1000);
  } else {
    teardown();
  }
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

// Pre-load desk link cards before first connect.
fetchSessionConfig()
  .then((cfg) => renderLinkCards(cfg.desk))
  .catch((err) => console.warn("Desk link preload failed:", err));

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && audioCtx && audioCtx.state !== "running") {
    audioCtx.resume().catch(() => {});
  }
});

els.connect.addEventListener("click", connect);
els.disconnect.addEventListener("click", disconnect);
els.reconnect.addEventListener("click", reconnect);
els.mute.addEventListener("click", () => setMuted(!isMuted));
els.clear.addEventListener("click", clearTranscript);
