'use strict';

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const { HASH_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase-Umgebungsvariablen fehlen.');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function normalizeIdentifier(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function validateIdentifier(value, type) {
  if (!value) return 'Bitte gib eine Angabe ein.';
  if (value.length > 120) return 'Die Angabe ist zu lang.';

  if (type === 'ausweis' && !/^[A-Z0-9]{9}$/.test(value)) {
    return 'Bitte gib eine gültige 9-stellige Personalausweisnummer ein.';
  }
  if (type === 'andere_angabe' && value.length < 3) {
    return 'Bitte gib eine eindeutigere Angabe ein.';
  }
  return null;
}

function createIdentifierHash(value, type) {
  if (!HASH_SECRET || HASH_SECRET.length < 32) {
    throw new Error('HASH_SECRET fehlt oder ist zu kurz.');
  }
  return crypto.createHmac('sha256', HASH_SECRET)
    .update(`${type}:${value}`, 'utf8')
    .digest('hex');
}

async function getCount(supabase) {
  const { count, error } = await supabase
    .from('redemptions')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    const supabase = getSupabase();

    if (req.method === 'GET' && req.url === '/api/stats') {
      return res.status(200).json({ count: await getCount(supabase) });
    }

    if (req.method === 'POST' && req.url === '/api/redeem') {
      const body = typeof req.body === 'object' && req.body ? req.body : {};
      const type = body.type === 'andere_angabe' ? 'andere_angabe' : 'ausweis';
      const identifier = normalizeIdentifier(body.identifier);
      const validationError = validateIdentifier(identifier, type);

      if (validationError) {
        return res.status(400).json({ status: 'invalid', message: validationError });
      }

      const identifier_hash = createIdentifierHash(identifier, type);
      const { error } = await supabase
        .from('redemptions')
        .insert({ identifier_hash, identifier_type: type });

      const count = await getCount(supabase);

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ status: 'exists', count });
        }
        throw error;
      }

      return res.status(201).json({ status: 'success', count });
    }

    return res.status(404).json({ status: 'error', message: 'Nicht gefunden.' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ status: 'error', message: 'Serverfehler. Bitte erneut versuchen.' });
  }
};
