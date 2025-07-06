const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// SQLite-Datenbank
const db = new sqlite3.Database('./data/familien.db');

// Initialisiere Tabellen
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, password TEXT, role TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, text TEXT, done INTEGER, image TEXT, notified_admin INTEGER DEFAULT 0, notified_user INTEGER DEFAULT 0)');
  db.run('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, from_user TEXT, to_user TEXT, text TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS kontostand (user TEXT PRIMARY KEY, amount INTEGER)');
});

// Datei-Upload konfigurieren
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// --- API-Routen ---
// Aufgabe hinzufügen
app.post('/api/task', (req, res) => {
  const { user, text } = req.body;
  db.run('INSERT INTO tasks (user, text, done, notified_user) VALUES (?, ?, 0, 1)', [user, text], function(err) {
    if (err) return res.status(500).send(err);
    res.json({ id: this.lastID });
  });
});

// Aufgaben holen
app.get('/api/tasks/:user', (req, res) => {
  const user = req.params.user;
  db.all('SELECT * FROM tasks WHERE user = ?', [user], (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

// Aufgabe erledigen
app.post('/api/task/:id/done', (req, res) => {
  const id = req.params.id;
  db.run('UPDATE tasks SET done = 1, notified_admin = 1 WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).send(err);
    res.sendStatus(200);
  });
});

// Neue Aufgaben für Kinder (Benachrichtigung)
app.get('/api/notifications/:user', (req, res) => {
  const user = req.params.user;
  db.all('SELECT * FROM tasks WHERE user = ? AND notified_user = 1', [user], (err, rows) => {
    if (err) return res.status(500).send(err);
    db.run('UPDATE tasks SET notified_user = 0 WHERE user = ?', [user]);
    res.json(rows);
  });
});

// Neue Erledigungen für Admin
app.get('/api/notifications-admin', (req, res) => {
  db.all('SELECT * FROM tasks WHERE done = 1 AND notified_admin = 1', [], (err, rows) => {
    if (err) return res.status(500).send(err);
    db.run('UPDATE tasks SET notified_admin = 0 WHERE done = 1');
    res.json(rows);
  });
});

// Bild-Upload
app.post('/api/upload', upload.single('image'), (req, res) => {
  res.json({ path: '/uploads/' + req.file.filename });
});

app.listen(port, () => {
  console.log(`Familien Manager läuft auf Port ${port}`);
});
