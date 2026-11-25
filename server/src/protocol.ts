/**
 * Хоппак realtime protocol v1.
 * Transport: plain WebSocket at /ws, every frame is JSON `{ "event": string, "data": object }`
 * (the NestJS WsAdapter format, so handlers are ordinary @SubscribeMessage methods).
 *
 * Client -> server
 *   create  { name, kind }                       -> room
 *   join    { code, name, kind }                 -> room | err(NOT_FOUND|FULL|IN_GAME)
 *   resume  { token }                            -> room (+ start if a round is running) | err(NO_SESSION)
 *   ready   { ready: boolean }                   -> room (to everyone)
 *   hero    { kind }                             -> room (to everyone), lobby only
 *   map     { map }            host only         -> room
 *   start   {}                 host only         -> start (to everyone)
 *   st      { x, y, vx, vy, f, a, m, ps, tk }    ~15 Hz, own player state, relayed in `snap`
 *   ev      { e, ... }         e = dead | mob | pick | ab   -> ev (to the others)
 *   leave   {}
 *   ping    { c }                                -> pong { c, s }
 *
 * Server -> client
 *   room    { code, you, token, host, phase, map, lw, round, players: PlayerInfo[] }
 *   start   { round, seed, map, lw, at, players: PlayerInfo[] }   `at` = server ms when the run begins
 *   snap    { ts, s: [pid, x, y, vx, vy, f, a, m, ps][] }          20 Hz while phase = play
 *   ev      { pid, e, ... }
 *   results { round, ranking: { pid, name, kind, m, place }[] }
 *   err     { code, msg }
 *   pong    { c, s }
 */
export const PROTOCOL_VERSION = 1;
export const MAX_PLAYERS = 4;
export const SNAP_HZ = 20;
export const RECONNECT_GRACE_MS = 10_000;
export const ROOM_IDLE_MS = 60 * 60_000;
export const START_DELAY_MS = 1500;
/** Fixed logical world width for online rooms: the map generator depends on LW, so every client must use the same one.
 * 180 fits all current phones at x2 (360-430 css px). */
export const NET_LW = 180;
export const MAPS = ['city', 'jungle', 'ice', 'lava', 'aqua', 'space'];
export const HERO_COUNT = 6;
export const MAX_MSGS_PER_SEC = 60;

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
