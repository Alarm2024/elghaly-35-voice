// Iris Desk Voice — AssemblyAI Voice Agent browser client.
//
// Flow: session-config + voice-token from server → WebSocket → PCM mic up, audio down.

const SAMPLE_RATE = 24_000;
const WS_URL = "wss://agents.assemblyai.com/v1/ws";

const els = {
  connect: document.getElementById("connect"),
  disconnect: document.getElementById("disconnect"),
  clear: document.getElementById("clear"),
  voice: document.getElementById("voice"),
  transcript: document.getElementById("transcript"),
  empty: document.getElementById("empty"),
  statusDot: document.getElementById("status-dot"),
  statusText: document.getElementById("status-text"),
};

let sessionConfig = null;
let ws = null;
let audioCtx = null;
let micStream = null;
let workletNode = null;
let micSource = null;
let playbackTime = 0;
let scheduledSources = [];
let userPartialEl = null;

function setStatus(state, text) {
  els.statusDot.className = "dot " + state;
  els.statusText.textContent = text;
}

function clearTranscript() {
  els.transcript.innerHTML = "";
  els.transcript.appendChild(els.empty);
  userPartialEl = null;
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

async function connect() {
  els.connect.disabled = true;
  setStatus("connecting", "Loading desk policy…");

  try {
    sessionConfig = await fetchSessionConfig();
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

  audioCtx = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: SAMPLE_RATE,
  });
  playbackTime = audioCtx.currentTime;
  scheduledSources = [];

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
    teardown();
  };

  workletNode.port.onmessage = (e) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const audio = arrayBufferToBase64(e.data);
    ws.send(JSON.stringify({ type: "input.audio", audio }));
  };
}

function handleEvent(event) {
  switch (event.type) {
    case "session.ready":
      setStatus("connected", `Connected (${event.session_id})`);
      els.disconnect.disabled = false;
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

    case "transcript.agent": {
      const meta = event.interrupted ? "interrupted" : null;
      addBubble("agent", event.text, meta);
      break;
    }

    case "reply.done":
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

function teardown() {
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
  setStatus("", "Disconnected");
  els.connect.disabled = false;
  els.disconnect.disabled = true;
}

function disconnect() {
  if (ws && ws.readyState === WebSocket.OPEN) ws.close();
  else teardown();
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

els.connect.addEventListener("click", connect);
els.disconnect.addEventListener("click", disconnect);
els.clear.addEventListener("click", clearTranscript);
