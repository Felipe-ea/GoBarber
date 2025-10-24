const db = require("../../db");
const webpush = require("web-push");

let VAPID_PUBLIC = "";
let VAPID_PRIVATE = "";

// Initialize VAPID keys
function initializeVapid(publicKey, privateKey) {
  VAPID_PUBLIC = publicKey;
  VAPID_PRIVATE = privateKey;
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(
      "mailto:admin@gobarber.app",
      VAPID_PUBLIC,
      VAPID_PRIVATE
    );
  }
}

// Get all subscriptions
function getSubscriptions() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM subscriptions", [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Send push notification to all subscribers
async function sendPushToAllSubs(payload) {
  const subs = await getSubscriptions();
  console.log(`📤 Sending notification to ${subs.length} subscription(s)`);
  console.log(`📦 Payload:`, JSON.stringify(payload));
  const results = [];

  for (const s of subs) {
    try {
      const pushSub = {
        endpoint: s.endpoint,
        keys: { p256dh: s.keys_p256dh, auth: s.keys_auth },
      };
      console.log(`🔄 Sending to subscription ${s.id}...`);
      await webpush.sendNotification(pushSub, JSON.stringify(payload));
      console.log(`✅ Successfully sent to subscription ${s.id}`);
      results.push({ id: s.id, ok: true });
    } catch (e) {
      const status = e.statusCode || e.code || 'unknown';
      console.error(`❌ Push error for subscription ${s.id}:`, e.message, `(status: ${status})`);
      if (e.body) console.error(`   Body:`, e.body);
      
      // Auto-remove expired/invalid subscriptions
      if (status === 404 || status === 410) {
        try {
          await new Promise((resolve, reject) => {
            db.run('DELETE FROM subscriptions WHERE id = ?', [s.id], (err) => (err ? reject(err) : resolve()));
          });
          console.log(`🧹 Removed invalid subscription id=${s.id}`);
        } catch (remErr) {
          console.warn(`Could not remove subscription ${s.id}:`, remErr.message);
        }
      }
      results.push({ id: s.id, ok: false, error: e.message, status });
    }
  }

  console.log(`📊 Results: ${results.filter(r => r.ok).length}/${results.length} successful`);
  return results;
}

// Get all clients
function getClients() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM clients", [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Get user preferences
function getPreferences() {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM user_preferences ORDER BY id DESC LIMIT 1",
      [],
      (err, row) => {
        if (err) reject(err);
        else
          resolve(
            row || {
              notify_frequency: "daily",
              notify_birthdays: 1,
              notify_no_cut_15: 1,
              notify_no_cut_30: 1,
              notify_time: "09:00",
            }
          );
      }
    );
  });
}

// Check if notification was already sent today
async function wasNotificationSentToday(eventType) {
  const date = new Date().toISOString().slice(0, 10);
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT 1 FROM notifications_sent WHERE event_type=? AND date=?",
      [eventType, date],
      (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      }
    );
  });
}

// Mark notification as sent
function markNotificationSent(eventType, clientId = null) {
  const date = new Date().toISOString().slice(0, 10);
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT OR IGNORE INTO notifications_sent (client_id, event_type, date) VALUES (?, ?, ?)",
      [clientId, eventType, date],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// Calculate days difference
function daysDiff(date1, date2) {
  return Math.round((date1 - date2) / (1000 * 60 * 60 * 24));
}

// Main notification check and send function
async function checkAndNotify() {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.log("VAPID keys not configured, skipping notifications");
    return;
  }

  try {
    const clients = await getClients();
    const prefs = await getPreferences();
    const now = new Date();

    // Check if we should send notifications today based on frequency
    const lastSent = await wasNotificationSentToday("daily_summary");
    if (lastSent && prefs.notify_frequency === "daily") {
      console.log("Notifications already sent today");
      return;
    }

    // Aggregate client data
    const birthdaysToday = [];
    const birthdays3 = [];
    const birthdays7 = [];
    const noCut15 = [];
    const noCut30 = [];

    for (const c of clients) {
      try {
        // Birthday checks
        if (prefs.notify_birthdays) {
          const b = new Date(c.birthday);
          const thisYear = new Date(
            now.getFullYear(),
            b.getMonth(),
            b.getDate()
          );
          const diffDays = daysDiff(thisYear, now);

          if (diffDays === 0) birthdaysToday.push(c);
          else if (diffDays > 0 && diffDays <= 3) birthdays3.push(c);
          else if (diffDays > 0 && diffDays <= 7) birthdays7.push(c);
        }

        // Last cut checks
        if (!c.lastCut) {
          if (prefs.notify_no_cut_15) noCut15.push(c);
        } else {
          const d = new Date(c.lastCut);
          const diff = daysDiff(now, d);
          if (diff > 30 && prefs.notify_no_cut_30) noCut30.push(c);
          else if (diff > 15 && prefs.notify_no_cut_15) noCut15.push(c);
        }
      } catch (e) {
        console.error("Error processing client:", e.message);
      }
    }

    // Build summary
    const parts = [];
    if (birthdaysToday.length) {
      parts.push(
        `🎂 ${birthdaysToday.length} aniversário(s) hoje: ${birthdaysToday
          .slice(0, 5)
          .map((x) => x.name)
          .join(", ")}${birthdaysToday.length > 5 ? "..." : ""}`
      );
    }
    if (birthdays3.length) {
      parts.push(
        `🎈 ${birthdays3.length} em 3 dias: ${birthdays3
          .slice(0, 5)
          .map((x) => x.name)
          .join(", ")}${birthdays3.length > 5 ? "..." : ""}`
      );
    }
    if (birthdays7.length) {
      parts.push(
        `📅 ${birthdays7.length} em 7 dias: ${birthdays7
          .slice(0, 5)
          .map((x) => x.name)
          .join(", ")}${birthdays7.length > 5 ? "..." : ""}`
      );
    }
    if (noCut15.length) {
      parts.push(
        `✂️ ${noCut15.length} sem corte >15d: ${noCut15
          .slice(0, 5)
          .map((x) => x.name)
          .join(", ")}${noCut15.length > 5 ? "..." : ""}`
      );
    }
    if (noCut30.length) {
      parts.push(
        `⚠️ ${noCut30.length} sem corte >30d: ${noCut30
          .slice(0, 5)
          .map((x) => x.name)
          .join(", ")}${noCut30.length > 5 ? "..." : ""}`
      );
    }

    if (parts.length === 0) {
      console.log("No notifications to send");
      return;
    }

    const totalAlerts =
      birthdaysToday.length +
      birthdays3.length +
      birthdays7.length +
      noCut15.length +
      noCut30.length;
    const title = `GoBarber — ${totalAlerts} alerta${
      totalAlerts > 1 ? "s" : ""
    }`;
    const body = parts.join(" • ");

    // Send notification
    await sendPushToAllSubs({ title, body, url: "/" });
    await markNotificationSent("daily_summary");
    console.log(`Notification sent: ${totalAlerts} alerts`);
  } catch (error) {
    console.error("Error in checkAndNotify:", error);
  }
}

// Trigger notifications for specific client (for testing)
async function triggerClientNotifications(clientId) {
  const clients = await getClients();
  const filtered = clientId
    ? clients.filter((c) => String(c.id) === String(clientId))
    : clients;
  const results = [];
  const now = new Date();

  for (const c of filtered) {
    const payloads = [];
    const b = new Date(c.birthday);
    const thisYear = new Date(now.getFullYear(), b.getMonth(), b.getDate());
    const diffDays = daysDiff(thisYear, now);

    if (diffDays === 0) {
      payloads.push({
        title: `🎂 Hoje é aniversário de ${c.name}!`,
        body: `Ligue ou envie uma mensagem para parabenizar.`,
        url: `/?client=${c.id}`,
      });
    }
    if (diffDays > 0 && diffDays <= 3) {
      payloads.push({
        title: `🎈 Aniversário em ${diffDays} dia(s): ${c.name}`,
        body: `Prepare uma oferta ou lembrete.`,
        url: `/?client=${c.id}`,
      });
    }
    if (diffDays > 0 && diffDays <= 7) {
      payloads.push({
        title: `📅 Aniversário próximo: ${c.name}`,
        body: `Faltam ${diffDays} dia(s) até o aniversário.`,
        url: `/?client=${c.id}`,
      });
    }

    if (!c.lastCut) {
      payloads.push({
        title: `✂️ ${c.name} sem registro de corte`,
        body: `Sem registro de corte — considere entrar em contato.`,
        url: `/?client=${c.id}`,
      });
    } else {
      const d = new Date(c.lastCut);
      const diff = daysDiff(now, d);
      if (diff > 30) {
        payloads.push({
          title: `⚠️ ${c.name} não corta há ${diff} dias`,
          body: `Cliente muito tempo sem corte (>30d).`,
          url: `/?client=${c.id}`,
        });
      } else if (diff > 15) {
        payloads.push({
          title: `✂️ ${c.name} não corta há ${diff} dias`,
          body: `Cliente sem corte >15 dias.`,
          url: `/?client=${c.id}`,
        });
      }
    }

    for (const p of payloads) {
      const r = await sendPushToAllSubs(p);
      results.push({ clientId: c.id, payload: p, result: r });
    }
  }

  return results;
}

module.exports = {
  initializeVapid,
  sendPushToAllSubs,
  checkAndNotify,
  triggerClientNotifications,
  getVapidPublic: () => VAPID_PUBLIC,
};
