const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const webpush = require("web-push");
const cron = require("node-cron");
const db = require("./db");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// VAPID keys: generate with web-push generate-vapid-keys
let VAPID_PUBLIC = process.env.VAPID_PUBLIC || "";
let VAPID_PRIVATE = process.env.VAPID_PRIVATE || "";

const fs = require("fs");

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    "mailto:admin@example.com",
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );
}

app.get("/api/vapidPublic", (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

// Clients CRUD
app.get("/api/clients", (req, res) => {
  const q = [];
  let sql = "SELECT * FROM clients";
  db.all(sql, q, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/clients", (req, res) => {
  const { name, phone, birthday, lastCut } = req.body;
  const stmt = db.prepare(
    "INSERT INTO clients (name, phone, birthday, lastCut) VALUES (?, ?, ?, ?)"
  );
  stmt.run(name, phone || "", birthday, lastCut || "", function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.put("/api/clients/:id", (req, res) => {
  const { id } = req.params;
  const { name, phone, birthday, lastCut } = req.body;
  db.run(
    "UPDATE clients SET name = ?, phone = ?, birthday = ?, lastCut = ? WHERE id = ?",
    [name, phone || "", birthday, lastCut || "", id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ changes: this.changes });
    }
  );
});

app.delete("/api/clients/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM clients WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changes: this.changes });
  });
});

// Subscriptions
app.post("/api/subscribe", (req, res) => {
  const sub = req.body;
  const endpoint = sub && sub.endpoint;
  if (!endpoint) return res.status(400).json({ error: "invalid subscription" });
  // avoid duplicates: check by endpoint
  db.get(
    "SELECT id FROM subscriptions WHERE endpoint = ?",
    [endpoint],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) return res.json({ id: row.id, ok: true });
      const p256 = (sub.keys || {}).p256dh || "";
      const auth = (sub.keys || {}).auth || "";
      db.run(
        "INSERT INTO subscriptions (endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?)",
        [endpoint, p256, auth],
        function (e) {
          if (e) return res.status(500).json({ error: e.message });
          res.json({ id: this.lastID });
        }
      );
    }
  );
});

app.get("/api/subscriptions", (req, res) => {
  db.all("SELECT * FROM subscriptions", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Endpoint to trigger notifications (for testing)
app.post("/api/notify", async (req, res) => {
  const { title, body } = req.body;
  db.all("SELECT * FROM subscriptions", [], async (err, subs) => {
    if (err) return res.status(500).json({ error: err.message });
    const payload = JSON.stringify({ title, body });
    const results = [];
    for (const s of subs) {
      try {
        const pushSub = {
          endpoint: s.endpoint,
          keys: { p256dh: s.keys_p256dh, auth: s.keys_auth },
        };
        await webpush.sendNotification(pushSub, payload);
        results.push({ id: s.id, ok: true });
      } catch (e) {
        results.push({ id: s.id, ok: false, error: e.message });
      }
    }
    res.json(results);
  });
});

// Try to load VAPID keys from key.md in project root if env not set
if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  try {
    const keyFile = path.join(__dirname, "key.md");
    if (fs.existsSync(keyFile)) {
      const txt = fs.readFileSync(keyFile, "utf8");
      const mPub = txt.match(/publicKey:\s*'([^']+)'/);
      const mPriv = txt.match(/privateKey:\s*'([^']+)'/);
      if (mPub && mPriv) {
        VAPID_PUBLIC = VAPID_PUBLIC || mPub[1];
        VAPID_PRIVATE = VAPID_PRIVATE || mPriv[1];
        webpush.setVapidDetails(
          "mailto:admin@example.com",
          VAPID_PUBLIC,
          VAPID_PRIVATE
        );
        console.log("Loaded VAPID keys from key.md");
      }
    }
  } catch (e) {
    console.warn("Could not load key.md", e.message);
  }
}

// Periodic job: checar clientes e enviar notificações quando aplicável (envia notificações personalizadas por cliente)
// Run daily at 09:00 server time to send notification summaries and reminders
cron.schedule("0 9 * * *", () => {
  checkAndNotify().catch(console.error);
});

async function sendPushToAllSubs(payload) {
  const subs = await new Promise((resolve, reject) =>
    db.all("SELECT * FROM subscriptions", [], (e, r) =>
      e ? reject(e) : resolve(r)
    )
  );
  const results = [];
  for (const s of subs) {
    try {
      const pushSub = {
        endpoint: s.endpoint,
        keys: { p256dh: s.keys_p256dh, auth: s.keys_auth },
      };
      await webpush.sendNotification(pushSub, JSON.stringify(payload));
      results.push({ id: s.id, ok: true });
    } catch (e) {
      results.push({ id: s.id, ok: false, error: e.message });
    }
  }
  return results;
}

async function checkAndNotify() {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const clients = await new Promise((resolve, reject) =>
    db.all("SELECT * FROM clients", [], (e, r) => (e ? reject(e) : resolve(r)))
  );
  const now = new Date();

  // aggregate lists
  const birthdaysToday = [];
  const birthdays3 = [];
  const birthdays7 = [];
  const noCut15 = [];
  const noCut30 = [];

  for (const c of clients) {
    try {
      const b = new Date(c.birthday);
      const thisYear = new Date(now.getFullYear(), b.getMonth(), b.getDate());
      const diffDays = Math.round((thisYear - now) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) birthdaysToday.push(c);
      else if (diffDays > 0 && diffDays <= 3) birthdays3.push(c);
      else if (diffDays > 0 && diffDays <= 7) birthdays7.push(c);

      if (!c.lastCut) noCut15.push(c);
      else {
        const d = new Date(c.lastCut);
        const diff = Math.round((now - d) / (1000 * 60 * 60 * 24));
        if (diff > 30) noCut30.push(c);
        else if (diff > 15) noCut15.push(c);
      }
    } catch (e) {
      console.error("aggregation error", e && e.message);
    }
  }

  // build summary
  const parts = [];
  if (birthdaysToday.length)
    parts.push(
      `${birthdaysToday.length} aniversário(s) hoje: ${birthdaysToday
        .slice(0, 5)
        .map((x) => x.name)
        .join(", ")}${birthdaysToday.length > 5 ? "..." : ""}`
    );
  if (birthdays3.length)
    parts.push(
      `${birthdays3.length} em 3 dias: ${birthdays3
        .slice(0, 5)
        .map((x) => x.name)
        .join(", ")}${birthdays3.length > 5 ? "..." : ""}`
    );
  if (birthdays7.length)
    parts.push(
      `${birthdays7.length} em 7 dias: ${birthdays7
        .slice(0, 5)
        .map((x) => x.name)
        .join(", ")}${birthdays7.length > 5 ? "..." : ""}`
    );
  if (noCut15.length)
    parts.push(
      `${noCut15.length} sem corte >15d: ${noCut15
        .slice(0, 5)
        .map((x) => x.name)
        .join(", ")}${noCut15.length > 5 ? "..." : ""}`
    );
  if (noCut30.length)
    parts.push(
      `${noCut30.length} sem corte >30d: ${noCut30
        .slice(0, 5)
        .map((x) => x.name)
        .join(", ")}${noCut30.length > 5 ? "..." : ""}`
    );

  if (parts.length === 0) return; // nothing to notify

  const title = `Resumo diário — ${
    birthdaysToday.length +
    birthdays3.length +
    birthdays7.length +
    noCut15.length +
    noCut30.length
  } alertas`;
  const body = parts.join(" · ");

  // dedupe by date (one summary per day)
  const date = new Date().toISOString().slice(0, 10);
  const sent = await new Promise((resolve, reject) =>
    db.get(
      "SELECT 1 FROM notifications_sent WHERE event_type=? AND date=?",
      ["daily_summary", date],
      (e, r) => (e ? reject(e) : resolve(r))
    )
  );
  if (sent) return;
  await sendPushToAllSubs({ title, body, url: "/" });
  db.run(
    "INSERT OR IGNORE INTO notifications_sent (client_id, event_type, date) VALUES (?, ?, ?)",
    [null, "daily_summary", date]
  );
}

// Endpoint to trigger personalized notifications for a client or all (useful for testing/production)
app.post("/api/notifyClient", async (req, res) => {
  const { clientId } = req.body || {};
  try {
    let clients = await new Promise((resolve, reject) =>
      db.all("SELECT * FROM clients", [], (e, r) =>
        e ? reject(e) : resolve(r)
      )
    );
    if (clientId)
      clients = clients.filter((c) => String(c.id) === String(clientId));
    const results = [];
    for (const c of clients) {
      const payloads = [];
      const now = new Date();
      const b = new Date(c.birthday);
      const thisYear = new Date(now.getFullYear(), b.getMonth(), b.getDate());
      const diffDays = Math.round((thisYear - now) / (1000 * 60 * 60 * 24));
      if (diffDays === 0)
        payloads.push({
          title: `Hoje é aniversário de ${c.name}!`,
          body: `Ligue ou envie uma mensagem para parabenizar.`,
          url: `/?client=${c.id}`,
        });
      if (diffDays > 0 && diffDays <= 3)
        payloads.push({
          title: `Aniversário em ${diffDays} dia(s): ${c.name}`,
          body: `Prepare uma oferta ou lembrete.`,
          url: `/?client=${c.id}`,
        });
      if (diffDays > 0 && diffDays <= 7)
        payloads.push({
          title: `Aniversário próximo: ${c.name}`,
          body: `Faz ${diffDays} dias até o aniversário.`,
          url: `/?client=${c.id}`,
        });
      if (!c.lastCut)
        payloads.push({
          title: `${c.name} sem registro de corte`,
          body: `Sem registro de corte — considere entrar em contato.`,
          url: `/?client=${c.id}`,
        });
      else {
        const d = new Date(c.lastCut);
        const diff = Math.round((now - d) / (1000 * 60 * 60 * 24));
        if (diff > 30)
          payloads.push({
            title: `${c.name} não corta há ${diff} dias`,
            body: `Cliente muito tempo sem corte (>30d).`,
            url: `/?client=${c.id}`,
          });
        else if (diff > 15)
          payloads.push({
            title: `${c.name} não corta há ${diff} dias`,
            body: `Cliente sem corte >15 dias.`,
            url: `/?client=${c.id}`,
          });
      }

      for (const p of payloads) {
        const r = await sendPushToAllSubs(p);
        results.push({ clientId: c.id, payload: p, result: r });
      }
    }
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log("Server running on port", PORT));
