const path = require("path");
const sqlite3 = require("sqlite3");
const DB_PATH = path.join(__dirname, "data", "gobarber.sqlite");
const fs = require("fs");

if (!fs.existsSync(path.join(__dirname, "data")))
  fs.mkdirSync(path.join(__dirname, "data"));

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    birthday TEXT NOT NULL,
    lastCut TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    keys_p256dh TEXT,
    keys_auth TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS notifications_sent (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    event_type TEXT,
    date TEXT,
    UNIQUE(client_id, event_type, date)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notify_frequency TEXT DEFAULT 'daily',
    notify_birthdays INTEGER DEFAULT 1,
    notify_no_cut_15 INTEGER DEFAULT 1,
    notify_no_cut_30 INTEGER DEFAULT 1,
    notify_time TEXT DEFAULT '09:00',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Ensure at least one preference record exists
  db.get("SELECT id FROM user_preferences LIMIT 1", [], (err, row) => {
    if (!row) {
      db.run(
        `INSERT INTO user_preferences (notify_frequency, notify_birthdays, notify_no_cut_15, notify_no_cut_30, notify_time) VALUES ('daily', 1, 1, 1, '09:00')`
      );
    }
  });
});

module.exports = db;
