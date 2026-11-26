/**
 * Caddy appends the peer it actually sees. Spoofed values sit to the left.
 * Trust exactly one proxy: the rightmost X-Forwarded-For entry is the client.
 * Without the header, use the socket address.
 */
export function clientAddress(xff: string | string[] | undefined, socketAddr?: string): string {
  const header = Array.isArray(xff) ? xff.join(',') : String(xff || '');
  const parts = header.split(',').map((s) => s.trim()).filter(Boolean);
  const raw = (parts.length ? parts[parts.length - 1] : String(socketAddr || '')).replace(/^::ffff:/, '');
  if (!raw || !/^[0-9a-fA-F:.]+$/.test(raw)) return '';
  return raw.slice(0, 64);
}
