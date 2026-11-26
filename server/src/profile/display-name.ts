/** Glyphs the client 5×7 font can draw. Same set as FONT in game/src/01_core.tsx. */
const FONT_CHARS = ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ.-:,+?!/()%●→←✓▶↑·▼';
const FONT = new Set(FONT_CHARS.split(''));

/** Whole string, uppercased, or null when any character is missing from the font. */
export function fontName(raw: string | null | undefined, max = 16): string | null {
  if (!raw) return null;
  const up = String(raw).toUpperCase();
  if (!up.length) return null;
  for (const ch of up) if (!FONT.has(ch)) return null;
  const t = up.trim().slice(0, max);
  return t || null;
}

/** Telegram first name, else @username, else a stable hopp-xxxx from the player id. */
export function displayName(first: string | null, username: string | null, playerId: string): string {
  return fontName(first) || fontName(username) || ('hopp-' + String(playerId || '').replace(/-/g, '').slice(0, 4));
}
