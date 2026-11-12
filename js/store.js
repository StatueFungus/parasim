// localStorage kann im privaten Modus fehlen oder werfen – alles defensiv.
const PREFIX = 'parasim:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

export function save(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* Speicher nicht verfügbar */ }
}
