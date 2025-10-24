const express = require("express");
const router = express.Router();
const db = require("../../db");

// GET current preferences
router.get("/", (req, res) => {
  db.get(
    "SELECT * FROM user_preferences ORDER BY id DESC LIMIT 1",
    [],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(
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

// PUT update preferences
router.put("/", (req, res) => {
  const {
    notify_frequency,
    notify_birthdays,
    notify_no_cut_15,
    notify_no_cut_30,
    notify_time,
  } = req.body;

  // Validate frequency
  const validFrequencies = ["daily", "every3days", "weekly", "disabled"];
  if (notify_frequency && !validFrequencies.includes(notify_frequency)) {
    return res.status(400).json({ error: "Frequência inválida" });
  }

  // Get current preferences
  db.get(
    "SELECT id FROM user_preferences ORDER BY id DESC LIMIT 1",
    [],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });

      const updateData = {
        notify_frequency: notify_frequency || "daily",
        notify_birthdays:
          notify_birthdays !== undefined ? (notify_birthdays ? 1 : 0) : 1,
        notify_no_cut_15:
          notify_no_cut_15 !== undefined ? (notify_no_cut_15 ? 1 : 0) : 1,
        notify_no_cut_30:
          notify_no_cut_30 !== undefined ? (notify_no_cut_30 ? 1 : 0) : 1,
        notify_time: notify_time || "09:00",
      };

      if (row) {
        // Update existing
        db.run(
          `UPDATE user_preferences SET 
          notify_frequency = ?, 
          notify_birthdays = ?, 
          notify_no_cut_15 = ?, 
          notify_no_cut_30 = ?,
          notify_time = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
          [
            updateData.notify_frequency,
            updateData.notify_birthdays,
            updateData.notify_no_cut_15,
            updateData.notify_no_cut_30,
            updateData.notify_time,
            row.id,
          ],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ...updateData, id: row.id });
          }
        );
      } else {
        // Insert new
        db.run(
          `INSERT INTO user_preferences (notify_frequency, notify_birthdays, notify_no_cut_15, notify_no_cut_30, notify_time) 
         VALUES (?, ?, ?, ?, ?)`,
          [
            updateData.notify_frequency,
            updateData.notify_birthdays,
            updateData.notify_no_cut_15,
            updateData.notify_no_cut_30,
            updateData.notify_time,
          ],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ...updateData, id: this.lastID });
          }
        );
      }
    }
  );
});

module.exports = router;
