// Thin wrapper around localStorage. Safe against private mode / bad JSON.
const PREFIX = 'freshbasket:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable; the app keeps working in memory.
  }
}
