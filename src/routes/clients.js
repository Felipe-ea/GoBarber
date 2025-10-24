const express = require("express");
const router = express.Router();
const db = require("../../db");

// Validation middleware
const validateClient = (req, res, next) => {
  const { name, birthday } = req.body;
  if (!name || !birthday) {
    return res
      .status(400)
      .json({ error: "Nome e data de aniversário são obrigatórios" });
  }
  next();
};

// GET all clients
router.get("/", (req, res) => {
  db.all("SELECT * FROM clients ORDER BY name ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET single client
router.get("/:id", (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM clients WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json(row);
  });
});

// POST new client
router.post("/", validateClient, (req, res) => {
  const { name, phone, birthday, lastCut } = req.body;
  db.run(
    "INSERT INTO clients (name, phone, birthday, lastCut) VALUES (?, ?, ?, ?)",
    [name, phone || "", birthday, lastCut || ""],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, name, phone, birthday, lastCut });
    }
  );
});

// PUT update client
router.put("/:id", validateClient, (req, res) => {
  const { id } = req.params;
  const { name, phone, birthday, lastCut } = req.body;
  db.run(
    "UPDATE clients SET name = ?, phone = ?, birthday = ?, lastCut = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [name, phone || "", birthday, lastCut || "", id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res.status(404).json({ error: "Cliente não encontrado" });
      res.json({ id, name, phone, birthday, lastCut });
    }
  );
});

// DELETE client
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM clients WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0)
      return res.status(404).json({ error: "Cliente não encontrado" });
    res.json({ message: "Cliente removido com sucesso" });
  });
});

module.exports = router;
