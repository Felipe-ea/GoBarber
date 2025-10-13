const path = require('path');
const sqlite3 = require('sqlite3');
const DB_PATH = path.join(__dirname, 'data', 'gobarber.sqlite');
const fs = require('fs');

if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));

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
});

module.exports = db;
