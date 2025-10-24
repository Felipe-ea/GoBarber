const express = require("express");
const router = express.Router();
const db = require("../../db");
const { sendPushToAllSubs } = require("../services/notificationService");

// POST subscribe to push notifications
router.post("/subscribe", (req, res) => {
  const sub = req.body;
  const endpoint = sub && sub.endpoint;
  if (!endpoint)
    return res.status(400).json({ error: "Subscription inválida" });

  // Check for duplicates by endpoint
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

// GET all subscriptions
router.get("/subscriptions", (req, res) => {
  db.all("SELECT * FROM subscriptions", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST manual notification (test endpoint)
router.post("/send", async (req, res) => {
  const { title, body, url } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: "Título e corpo são obrigatórios" });
  }

  try {
    const results = await sendPushToAllSubs({ title, body, url: url || "/" });
    res.json({
      sent: results.filter((r) => r.ok).length,
      total: results.length,
      results,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST trigger client-specific notifications
router.post("/trigger", async (req, res) => {
  const { clientId } = req.body || {};
  const notificationService = require("../services/notificationService");

  try {
    const results = await notificationService.triggerClientNotifications(
      clientId
    );
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
