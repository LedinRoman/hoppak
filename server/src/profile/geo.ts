/** ISO-3166 alpha-2 → main language, stored only. The UI is not localized. */
const LANG: Record<string, string> = {
  RU: 'ru', BY: 'ru', KZ: 'ru', UA: 'uk', US: 'en', GB: 'en', IE: 'en', AU: 'en', CA: 'en', NZ: 'en',
  DE: 'de', AT: 'de', CH: 'de', FR: 'fr', BE: 'fr', ES: 'es', MX: 'es', AR: 'es', IT: 'it', PT: 'pt',
  BR: 'pt', PL: 'pl', NL: 'nl', SE: 'sv', NO: 'no', FI: 'fi', DK: 'da', CZ: 'cs', TR: 'tr', JP: 'ja',
  KR: 'ko', CN: 'zh', TW: 'zh', HK: 'zh', IN: 'hi', IL: 'he', GR: 'el', RO: 'ro', HU: 'hu', BG: 'bg',
  RS: 'sr', HR: 'hr', SK: 'sk', SI: 'sl', LT: 'lt', LV: 'lv', EE: 'et', GE: 'ka', AM: 'hy', AZ: 'az',
  UZ: 'uz', TH: 'th', VN: 'vi', ID: 'id', MY: 'ms', PH: 'en', SA: 'ar', AE: 'ar', EG: 'ar',
};

export function originLanguage(country: string | null): string | null {
  if (!country) return null;
  return LANG[country] || null;
}

/** Loopback, link-local and RFC1918 addresses have no country. */
export function isPublicIp(ip: string): boolean {
  if (!ip) return false;
  const s = ip.toLowerCase().replace(/^::ffff:/, '');
  if (s === '::1' || s === '0.0.0.0') return false;
  if (s.startsWith('fe80:') || s.startsWith('fc') || s.startsWith('fd')) return false;
  if (/^127\./.test(s) || /^10\./.test(s) || /^192\.168\./.test(s) || /^169\.254\./.test(s)) return false;
  const m = /^172\.(\d+)\./.exec(s);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return false;
  }
  return true;
}

/** Offline lookup. A missing database must not throw into the request. */
export function countryOfIp(ip: string): string | null {
  if (!isPublicIp(ip)) return null;
  try {
    // geoip-lite ships a local MaxMind country file. No network call.
    const geoip = require('geoip-lite');
    const hit = geoip.lookup(ip);
    const c = hit && hit.country;
    return typeof c === 'string' && /^[A-Z]{2}$/.test(c) ? c : null;
  } catch (err) {
    console.error('geo lookup failed');
    return null;
  }
}
