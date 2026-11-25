import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Хоппак realtime protocol v2 (supports N = 2 and N-1 = 1).
 * Transport: plain WebSocket at /ws (optional query ?p=1|2, default 1),
 * every frame is JSON `{ "event": string, "data": object }`
 * (the NestJS WsAdapter format, so handlers are ordinary @SubscribeMessage methods).
 *
 * Handshake
 *   Connect /ws or /ws?p=1   -> hello { v: 1, s, node }
 *   Connect /ws?p=2           -> hello { v: 2, s, node, version, field: { w, h, pxPerM } }
 *   Unsupported ?p            -> err { code: "UNSUPPORTED_PROTOCOL", msg: "Онлайн недоступен, обновитесь", minProtocol, protocol }
 *                                + hello { v: 2, s, node, minProtocol, protocol, supported: false } -> close(4002)
 *
 * Client -> server
 *   create  { name, kind }                       -> room | redirect (v2 when draining) | err(DRAINING)
 *   join    { code, name, kind }                 -> room | redirect (v2 when on peer) | err(NOT_FOUND|WRONG_NODE|FULL|IN_GAME|PROTOCOL_MISMATCH)
 *   resume  { token }                            -> room (+ start if a round is running) | err(NO_SESSION)
 *   ready   { ready: boolean }                   -> room (to everyone)
 *   hero    { kind }                             -> room (to everyone), lobby only
 *   map     { map }            host only         -> room
 *   start   {}                 host only         -> start (to everyone) | redirect (v2 when draining) | err(DRAINING)
 *   st      { x, y, vx, vy, f, a, m, ps, tk }    ~15 Hz, own player state, relayed in `snap`
 *   ev      { e, ... }         e = dead | mob | pick | ab   -> ev (to the others)
 *   leave   {}
 *   ping    { c }                                -> pong { c, s }
 *
 * Server -> client
 *   hello    { v, s, node, version?, field? }
 *   room     { code, you, token, host, phase, map, lw, field?, round, players: PlayerInfo[] }
 *   start    { round, seed, map, lw, field?, at, players: PlayerInfo[] }   `at` = server ms when the run begins
 *   snap     { ts, s: [pid, x, y, vx, vy, f, a, m, ps][] }          20 Hz while phase = play
 *   ev       { pid, e, ... }
 *   results  { round, ranking: { pid, name, kind, m, place }[] }
 *   redirect { node, code?, reason? }            (v2+ only) reconnect to /ws/<node>
 *   update   { version }                         (v2+ only) newer server/client version is live
 *   err      { code, msg }
 *   pong     { c, s }
 */
export const PROTOCOL_VERSION = 2;
export const MIN_PROTOCOL_VERSION = 1;
export const MAX_PLAYERS = 4;
export const SNAP_HZ = 20;
export const RECONNECT_GRACE_MS = 10_000;
export const ROOM_IDLE_MS = 60 * 60_000;
export const START_DELAY_MS = 1500;

export interface FieldConfig {
  w: number;
  h: number;
  pxPerM: number;
}

export const DEFAULT_FIELD: FieldConfig = { w: 160, h: 346, pxPerM: 8 };
export const DEFAULT_FIELD_W_V1 = 180;

/** Sane bounds for the field (BUG-47): anything outside is rejected with an ERROR log and the default is used. */
export const FIELD_BOUNDS = {
  w: { min: 120, max: 320 },
  h: { min: 200, max: 800 },
  pxPerM: { min: 2, max: 32 },
} as const;

type FieldLog = (level: 'log' | 'warn' | 'error', msg: string) => void;
const defaultFieldLog: FieldLog = (level, msg) => {
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(`[Field] ${msg}`);
};

/** Parse one numeric field value; undefined = not set. Returns NaN-free value or null (rejected, logged). */
function boundedNum(
  raw: unknown, key: keyof typeof FIELD_BOUNDS, source: string, integer: boolean, log: FieldLog,
): number | null | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  const { min, max } = FIELD_BOUNDS[key];
  if (!Number.isFinite(n) || n < min || n > max || (integer && Math.round(n) !== n)) {
    log('error', `invalid ${key}=${JSON.stringify(raw)} from ${source} (allowed ${min}..${max}${integer ? ', integer' : ''}); ignored`);
    return null;
  }
  return n;
}

function readFieldJson(log: FieldLog): { cfg: Record<string, unknown>; source: string } {
  const explicit = (process.env.FIELD_CONFIG_PATH || '').trim();
  if (explicit) {
    if (!existsSync(explicit)) {
      log('error', `FIELD_CONFIG_PATH=${explicit} does not exist; using env/defaults`);
      return { cfg: {}, source: 'defaults' };
    }
  }
  const candidates = [
    explicit,
    join(process.cwd(), 'field.config.json'),
    join(__dirname, '..', 'field.config.json'),
    join(__dirname, '..', '..', 'field.config.json'),
  ].filter((p): p is string => Boolean(p && p.trim()));

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { cfg: parsed, source: file };
      log('error', `${file} is not a JSON object; using env/defaults`);
    } catch (e) {
      log('error', `${file} is not valid JSON (${(e as Error).message}); using env/defaults`);
    }
    return { cfg: {}, source: 'defaults' };
  }
  log('warn', 'no field.config.json found (not baked into the Docker image); using env/defaults');
  return { cfg: {}, source: 'defaults' };
}

function pick(
  key: keyof typeof FIELD_BOUNDS, envNames: string[], fileCfg: Record<string, unknown>, fileSrc: string,
  integer: boolean, fallback: number, log: FieldLog,
): number {
  for (const name of envNames) {
    const v = boundedNum(process.env[name], key, `env ${name}`, integer, log);
    if (typeof v === 'number') return v;
    if (v === null) break; // invalid env -> fall through to file/default (already logged)
  }
  const f = boundedNum(fileCfg[key], key, fileSrc, integer, log);
  if (typeof f === 'number') return f;
  return fallback;
}

let cachedField: FieldConfig | null = null;
let cachedV1: number | null = null;

export function loadFieldConfig(log: FieldLog = defaultFieldLog): FieldConfig {
  if (cachedField) return { ...cachedField };
  const { cfg, source } = readFieldJson(log);
  const w = pick('w', ['FIELD_W', 'NET_LW'], cfg, source, true, DEFAULT_FIELD.w, log);
  const h = pick('h', ['FIELD_H'], cfg, source, true, DEFAULT_FIELD.h, log);
  const pxPerM = pick('pxPerM', ['FIELD_PX_PER_M', 'FIELD_SCALE'], cfg, source, false, DEFAULT_FIELD.pxPerM, log);
  cachedField = { w, h, pxPerM };
  log('log', `v2 field: ${JSON.stringify(cachedField)} (file: ${source})`);
  return { ...cachedField };
}

export function loadV1FieldWidth(log: FieldLog = defaultFieldLog): number {
  if (cachedV1 !== null) return cachedV1;
  let w = DEFAULT_FIELD_W_V1;
  for (const name of ['FIELD_W_V1', 'NET_LW_V1']) {
    const v = boundedNum(process.env[name], 'w', `env ${name}`, true, log);
    if (typeof v === 'number') { w = v; break; }
    if (v === null) break;
  }
  cachedV1 = w;
  log('log', `v1 room width: ${w}`);
  return w;
}

/** Test hook. */
export function resetFieldCache() { cachedField = null; cachedV1 = null; }

export const MAPS = ['city', 'jungle', 'ice', 'lava', 'aqua', 'space'];
export const HERO_COUNT = 6;
export const MAX_MSGS_PER_SEC = 60;
/** No state from a live runner for this long during a round = counted as fallen (AFK / frozen tab). */
export const STALE_MS = 15_000;

export type Phase = 'lobby' | 'play' | 'results';

export interface PlayerInfo {
  pid: number;
  slot: number;
  name: string;
  kind: number;
  ready: boolean;
  on: boolean;
}

export interface Msg<T = any> {
  event: string;
  data: T;
}
