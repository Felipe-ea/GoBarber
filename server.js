const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const notificationService = require('./src/services/notificationService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Load VAPID keys
let VAPID_PUBLIC = process.env.VAPID_PUBLIC || '';
let VAPID_PRIVATE = process.env.VAPID_PRIVATE || '';

// Try to load from key.md if not in env
if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  try {
    const keyFile = path.join(__dirname, 'key.md');
    if (fs.existsSync(keyFile)) {
      const txt = fs.readFileSync(keyFile, 'utf8');
      // Support multiple formats (case-insensitive, with or without quotes)
      const mPub = txt.match(/public\s*key\s*:\s*['"]?([^'"\r\n]+)['"]?/i) || txt.match(/publicKey\s*:\s*['"]?([^'"\r\n]+)['"]?/i);
      const mPriv = txt.match(/private\s*key\s*:\s*['"]?([^'"\r\n]+)['"]?/i) || txt.match(/privateKey\s*:\s*['"]?([^'"\r\n]+)['"]?/i);
      if (mPub && mPriv) {
        VAPID_PUBLIC = mPub[1].trim();
        VAPID_PRIVATE = mPriv[1].trim();
        console.log('✅ VAPID keys loaded from key.md');
      }
    }
  } catch (e) {
    console.warn('⚠️ Could not load key.md:', e.message);
  }
}

// Initialize notification service with VAPID keys
notificationService.initializeVapid(VAPID_PUBLIC, VAPID_PRIVATE);

// API Routes
app.get('/api/vapidPublic', (req, res) => {
  res.json({ publicKey: notificationService.getVapidPublic() });
});

app.use('/api/clients', require('./src/routes/clients'));
app.use('/api/preferences', require('./src/routes/preferences'));
app.use('/api/notifications', require('./src/routes/notifications'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Schedule notifications based on user preferences
// Check every hour and decide based on preferences
cron.schedule('0 * * * *', async () => {
  try {
    const db = require('./db');
    const prefs = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM user_preferences ORDER BY id DESC LIMIT 1', [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!prefs || prefs.notify_frequency === 'disabled') {
      console.log('⏸️ Notifications disabled');
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const [targetHour] = (prefs.notify_time || '09:00').split(':').map(Number);

    // Only run at the specified hour
    if (currentHour !== targetHour) {
      return;
    }

    // Check frequency
    const lastSent = await new Promise((resolve, reject) => {
      const date = now.toISOString().slice(0, 10);
      db.get(
        'SELECT date FROM notifications_sent WHERE event_type=? ORDER BY date DESC LIMIT 1',
        ['daily_summary'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.date : null);
        }
      );
    });

    if (lastSent) {
      const daysSinceLastSent = Math.floor((now - new Date(lastSent)) / (1000 * 60 * 60 * 24));
      if (prefs.notify_frequency === 'daily' && daysSinceLastSent < 1) return;
      if (prefs.notify_frequency === 'every3days' && daysSinceLastSent < 3) return;
      if (prefs.notify_frequency === 'weekly' && daysSinceLastSent < 7) return;
    }

    console.log('🔔 Running scheduled notification check...');
    await notificationService.checkAndNotify();
  } catch (error) {
    console.error('❌ Error in scheduled notification:', error);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 GoBarber server running on port ${PORT}`);
  console.log(`📱 PWA available at http://localhost:${PORT}`);
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    console.log('✅ Push notifications enabled');
  } else {
    console.log('⚠️ Push notifications disabled (VAPID keys not configured)');
  }
});

// Error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
