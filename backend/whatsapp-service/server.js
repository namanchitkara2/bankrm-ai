/**
 * WhatsApp Web bridge — Banking CRM Agent outreach + AI sales agent
 *
 * Outbound: send personalized messages to customers
 * Inbound:  capture replies, run AI sales agent, auto-reply on WhatsApp
 *
 * REST API:
 *   GET  /            → QR page or connected page
 *   GET  /status      → { ready, state }
 *   GET  /qr          → { ready, qr, state }
 *   POST /send        → { phone, message }
 *   POST /send-batch  → { messages: [{phone, message}] }
 *   GET  /replies     → last 50 incoming messages (for dashboard)
 */

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode  = require("qrcode-terminal");
const express = require("express");
const http    = require("http");

const PORT           = parseInt(process.argv.find(a => a.startsWith("--port="))?.split("=")[1] ?? "3001");
const BACKEND_URL    = process.env.BACKEND_URL    || "http://localhost:8000";
const AI_AUTO_REPLY  = process.env.AI_AUTO_REPLY  !== "false"; // default ON

// ── State ─────────────────────────────────────────────────────────────────────
let clientReady = false;
let latestQR    = null;
let clientState = "INITIALIZING";

// In-memory ring buffer — last 100 incoming messages for the dashboard
const replyLog = [];
const MAX_LOG  = 100;

// ── WhatsApp client ───────────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.ww-session" }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox", "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", "--disable-accelerated-2d-canvas",
      "--no-first-run", "--disable-gpu",
    ],
  },
});

client.on("qr", (qr) => {
  latestQR    = qr;
  clientState = "QR_READY";
  console.log("\n── Scan this QR code with WhatsApp ──────────────────────────");
  qrcode.generate(qr, { small: true });
  console.log("─────────────────────────────────────────────────────────────\n");
});

client.on("authenticated", () => {
  clientState = "AUTHENTICATED";
  latestQR    = null;
  console.log("✅ WhatsApp authenticated — session saved");
});

client.on("ready", () => {
  clientReady = true;
  clientState = "READY";
  latestQR    = null;
  console.log(`🟢 WhatsApp client ready — service on http://localhost:${PORT}`);
  console.log(`   AI auto-reply: ${AI_AUTO_REPLY ? "ON" : "OFF"}`);
});

client.on("disconnected", (reason) => {
  clientReady = false;
  clientState = "DISCONNECTED";
  console.log("🔴 WhatsApp disconnected:", reason);
});

// ── Incoming message handler ──────────────────────────────────────────────────
client.on("message", async (msg) => {
  // Ignore group messages and our own outbound messages
  if (msg.isGroupMsg || msg.fromMe) return;

  const phone   = "+" + msg.from.replace("@c.us", "");
  const text    = msg.body?.trim() || "";
  const ts      = new Date().toISOString();

  console.log(`\n📩 Incoming from ${phone}: "${text}"`);

  // Log it
  const entry = { phone, text, ts, aiReply: null, status: "received" };
  replyLog.unshift(entry);
  if (replyLog.length > MAX_LOG) replyLog.pop();

  // 1. Tell the Python backend — it will log to CRM + generate AI reply
  try {
    const aiReply = await callBackendReply(phone, text);
    if (aiReply && AI_AUTO_REPLY) {
      await client.sendMessage(msg.from, aiReply);
      entry.aiReply = aiReply;
      entry.status  = "replied";
      console.log(`🤖 AI replied to ${phone}:\n   ${aiReply.slice(0, 80)}…`);
    }
  } catch (err) {
    entry.status = "error";
    console.error("AI reply error:", err.message);
  }
});

// ── Helper: POST to Python backend /api/outreach/reply ────────────────────────
function callBackendReply(phone, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ phone, message: text });
    const url  = new URL("/api/outreach/reply", BACKEND_URL);

    const req = http.request(
      { hostname: url.hostname, port: url.port || 8000, path: url.pathname,
        method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
      (res) => {
        let data = "";
        res.on("data", (c) => data += c);
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json.ai_reply || null);
          } catch { resolve(null); }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

client.initialize().catch((err) => {
  console.error("WhatsApp init error:", err.message);
  clientState = "ERROR";
});

// ── Express API ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Visual status page
app.get("/", (_req, res) => {
  if (clientReady) {
    return res.send(`<html><body style="background:#111;color:#4ade80;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px">
      <div style="font-size:48px">✅</div>
      <div style="font-size:24px;font-weight:bold">WhatsApp Connected + AI Agent Active</div>
      <div style="color:#888">Incoming messages will get AI replies automatically</div>
    </body></html>`);
  }
  if (!latestQR) {
    return res.send(`<html><body style="background:#111;color:#aaa;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px">
      <div style="font-size:32px">⏳</div><div style="font-size:20px">Starting… (${clientState})</div>
      <script>setTimeout(()=>location.reload(),5000)</script>
    </body></html>`);
  }
  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(latestQR)}`;
  res.send(`<html><body style="background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:20px">
    <div style="font-size:20px;font-weight:bold">📱 Scan with WhatsApp → Linked Devices</div>
    <img src="${qrImg}" style="border-radius:16px;border:4px solid #333" width="260" height="260"/>
    <script>setTimeout(()=>location.reload(),5000)</script>
  </body></html>`);
});

app.get("/status", (_req, res) => res.json({ ready: clientReady, state: clientState }));

app.get("/qr", (_req, res) => {
  if (clientReady) return res.json({ ready: true, qr: null });
  if (!latestQR)   return res.json({ ready: false, qr: null, state: clientState });
  res.json({ ready: false, qr: latestQR, state: clientState });
});

// Last N incoming replies (for dashboard polling)
app.get("/replies", (_req, res) => res.json(replyLog.slice(0, 50)));

// Send single
app.post("/send", async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ status: "error", error: "phone and message required" });
  if (!clientReady)        return res.status(503).json({ status: "error", error: `Not ready (${clientState})` });
  try {
    const chatId = phone.replace(/^\+/, "") + "@c.us";
    const msg    = await client.sendMessage(chatId, message);
    res.json({ status: "sent", messageId: msg.id._serialized, phone });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// Send batch
app.post("/send-batch", async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages)) return res.status(400).json({ status: "error", error: "messages array required" });
  const results = [];
  for (const { phone, message } of messages) {
    if (!clientReady) { results.push({ phone, status: "error", error: `Not ready (${clientState})` }); continue; }
    try {
      const chatId = phone.replace(/^\+/, "") + "@c.us";
      const msg    = await client.sendMessage(chatId, message);
      results.push({ phone, status: "sent", messageId: msg.id._serialized });
    } catch (err) {
      results.push({ phone, status: "error", error: err.message });
    }
  }
  res.json({ results });
});

app.listen(PORT, () => {
  console.log(`\n🚀 WhatsApp service on http://localhost:${PORT}`);
  console.log("   Waiting for WhatsApp to initialize…\n");
});
