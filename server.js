'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HASH_SECRET = process.env.HASH_SECRET;

if (!HASH_SECRET || HASH_SECRET.length < 32) {
  console.error('HASH_SECRET fehlt oder ist zu kurz. Lege eine .env-Datei anhand von .env.example an.');
  process.exit(1);
}

const dbPath = path.join(__dirname, 'data', 'shot-log.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier_hash TEXT NOT NULL UNIQUE,
    identifier_type TEXT NOT NULL CHECK(identifier_type IN ('ausweis', 'andere_angabe')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const insertRedemption = db.prepare(`
  INSERT INTO redemptions (identifier_hash, identifier_type)
  VALUES (?, ?)
  ON CONFLICT(identifier_hash) DO NOTHING
`);
const countRedemptions = db.prepare('SELECT COUNT(*) AS count FROM redemptions');

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function normalizeIdentifier(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function validateIdentifier(value, type) {
  if (!value) return 'Bitte gib eine Angabe ein.';
  if (value.length > 120) return 'Die Angabe ist zu lang.';

  if (type === 'ausweis') {
    // Deutsche Personalausweisnummer: 9 Zeichen, Großbuchstaben und Ziffern.
    if (!/^[A-Z0-9]{9}$/.test(value)) {
      return 'Bitte gib eine gültige 9-stellige Personalausweisnummer ein.';
    }
  }

  if (type === 'andere_angabe' && value.length < 3) {
    return 'Bitte gib eine eindeutigere Angabe ein.';
  }

  return null;
}

function createIdentifierHash(value, type) {
  return crypto
    .createHmac('sha256', HASH_SECRET)
    .update(`${type}:${value}`, 'utf8')
    .digest('hex');
}

app.get('/api/stats', (req, res) => {
  const { count } = countRedemptions.get();
  res.json({ count });
});

app.post('/api/redeem', (req, res) => {
  const type = req.body?.type === 'andere_angabe' ? 'andere_angabe' : 'ausweis';
  const identifier = normalizeIdentifier(req.body?.identifier);
  const validationError = validateIdentifier(identifier, type);

  if (validationError) {
    return res.status(400).json({ status: 'invalid', message: validationError });
  }

  const identifierHash = createIdentifierHash(identifier, type);
  const result = insertRedemption.run(identifierHash, type);
  const { count } = countRedemptions.get();

  if (result.changes === 0) {
    return res.status(409).json({ status: 'exists', count });
  }

  return res.status(201).json({ status: 'success', count });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ status: 'error', message: 'Serverfehler. Bitte erneut versuchen.' });
});

app.listen(PORT, () => {
  console.log(`Shot-Log läuft auf http://localhost:${PORT}`);
});
