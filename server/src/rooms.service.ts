import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomBytes, randomInt } from 'crypto';
import type { WebSocket } from 'ws';
import {
  STALE_MS, HERO_COUNT, MAPS, MAX_PLAYERS, NET_LW, Phase, PlayerInfo, RECONNECT_GRACE_MS, ROOM_IDLE_MS, SNAP_HZ, START_DELAY_MS, BREAK_RESTORE_MS,
} from './protocol';
import { setAccountKick } from './session-kick';

export interface Player {
  pid: number;
  slot: number;
  name: string;
  kind: number;
  ready: boolean;
  token: string;
  ws: WebSocket | null;
  offSince: number; // 0 = connected
  /** latest relayed state: [x, y, vx, vy, face, alive, maxH, poseFlags] */
  st: number[] | null;
  stDirty: boolean;
  lastStAt: number;
  dead: boolean;
  m: number; // metres reached (reported)
  suspicious: number;
  /** Host client simulates this seat. No socket. */
  bot: boolean;
  /** Profile id when the socket presented a bearer. Two seats of one account are not allowed. */
  accountId?: string;
  /** Hash of the bearer this socket logged in with. A newer login does not close itself. */
  sessionId?: string;
}

export interface Room {
  code: string;
  host: number;
  phase: Phase;
  map: string;
  lw: number;
  round: number;
  seed: number;
  startAt: number;
  players: Player[];
  nextPid: number;
  touched: number;
  snapTimer: NodeJS.Timeout | null;
  /** seq -> restore timer. Server is the source of truth for a shared red platform. */
  broken: Map<number, NodeJS.Timeout>;
  /** Empty string is a client that sent no generation (0.59). Equal values may share a room. */
  gen: string;
}

export class RoomError extends Error {
  constructor(public code: string, msg: string) { super(msg); }
}

/** Per-socket session data, stored on the ws object. */
export interface Sess {
  room?: Room; player?: Player; win: number; winN: number;
  accountId?: string; sessionId?: string;
  clientVersion?: string; platform?: string;
}

export const stats = { msgsIn: 0, msgsOut: 0, bytesOut: 0, snaps: 0 };

@Injectable()
export class RoomsService implements OnModuleDestroy {
  private readonly log = new Logger('Rooms');
  readonly rooms = new Map<string, Room>();
  private readonly byToken = new Map<string, { room: Room; player: Player }>();
  private sweeper = setInterval(() => this.sweep(), 2000);

  constructor() {
    setAccountKick((id, sessionId) => this.kickAccount(id, sessionId));
  }

  onModuleDestroy() {
    clearInterval(this.sweeper);
    for (const r of this.rooms.values()) if (r.snapTimer) clearInterval(r.snapTimer);
  }

  /* ---------- helpers ---------- */
  static cleanName(s: unknown, kind: number) {
    const t = String(s ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 10);
    return t || 'ИГРОК' + (kind + 1);
  }
  static cleanGen(g: unknown) {
    if (g == null || g === '') return '';
    const s = String(g).trim().slice(0, 16);
    return /^[0-9A-Za-z._-]+$/.test(s) ? s : '';
  }
  static cleanKind(k: unknown) {
    const n = Number(k);
    return Number.isInteger(n) && n >= 0 && n < HERO_COUNT ? n : 0;
  }
  info(p: Player): PlayerInfo {
    return { pid: p.pid, slot: p.slot, name: p.name, kind: p.kind, ready: p.ready, on: p.bot || !p.offSince, bot: p.bot || undefined };
  }
  roomView(r: Room, p: Player) {
    return {
      code: r.code, you: p.pid, token: p.token, host: r.host, phase: r.phase, map: r.map, lw: r.lw, round: r.round,
      players: r.players.map((q) => this.info(q)),
    };
  }
  send(ws: WebSocket | null, event: string, data: unknown) {
    if (!ws || ws.readyState !== 1) return;
    const s = JSON.stringify({ event, data });
    stats.msgsOut++; stats.bytesOut += s.length;
    ws.send(s);
  }
  broadcast(r: Room, event: string, data: unknown, exceptPid = -1) {
    for (const p of r.players) if (p.pid !== exceptPid) this.send(p.ws, event, data);
  }
  /** Each player gets the room view with its own `you`/`token`. */
  pushRoom(r: Room) {
    for (const p of r.players) this.send(p.ws, 'room', this.roomView(r, p));
  }

  private newCode() {
    for (let i = 0; i < 200; i++) {
      const c = String(randomInt(1000, 10000));
      if (!this.rooms.has(c)) return c;
    }
    throw new RoomError('BUSY', 'no free room codes');
  }
  private freeSlot(r: Room) {
    for (let s = 0; s < MAX_PLAYERS; s++) if (!r.players.some((p) => p.slot === s)) return s;
    return -1;
  }
  private placeName(name: unknown, kind: number, trusted: boolean) {
    if (!trusted) return RoomsService.cleanName(name, kind);
    const t = String(name ?? '').trim().slice(0, 16);
    return t || 'HOPP';
  }
  kickAccount(accountId: string, keepSession?: string) {
    if (!accountId) return;
    for (const r of [...this.rooms.values()]) {
      for (const p of [...r.players]) {
        if (p.accountId !== accountId) continue;
        if (keepSession && p.sessionId === keepSession) continue;
        this.dropReplaced(r, p);
      }
    }
  }
  private dropReplaced(r: Room, p: Player) {
    this.send(p.ws, 'replaced', {});
    try { if (p.ws) p.ws.close(4001, 'replaced'); } catch { /* ignore */ }
    const sock = p.ws as WebSocket & { sess?: Sess };
    if (sock && sock.sess) { sock.sess.room = undefined; sock.sess.player = undefined; }
    this.remove(r, p);
  }
  private addPlayer(r: Room, ws: WebSocket, name: unknown, kind: unknown, accountId?: string): Player {
    const k = RoomsService.cleanKind(kind);
    if (accountId) {
      for (const q of [...r.players]) if (q.accountId === accountId) this.dropReplaced(r, q);
      if (!this.rooms.has(r.code)) this.rooms.set(r.code, r);
    }
    const p: Player = {
      pid: r.nextPid++, slot: this.freeSlot(r), name: this.placeName(name, k, !!accountId), kind: k, ready: false,
      accountId: accountId || undefined,
      token: randomBytes(12).toString('base64url'), ws, offSince: 0, st: null, stDirty: false, lastStAt: 0,
      dead: false, m: 0, suspicious: 0, bot: false,
    };
    r.players.push(p);
    if (!r.players.some((q) => q.pid === r.host)) r.host = p.pid;
    this.byToken.set(p.token, { room: r, player: p });
    r.touched = Date.now();
    return p;
  }

  /* ---------- lobby ---------- */
  create(ws: WebSocket, name: unknown, kind: unknown, gen?: unknown, accountId?: string) {
    const code = this.newCode();
    const r: Room = {
      code, host: 0, phase: 'lobby', map: 'city', lw: NET_LW, round: 0, seed: 0, startAt: 0, players: [], nextPid: 0,
      touched: Date.now(), snapTimer: null, broken: new Map(), gen: RoomsService.cleanGen(gen),
    };
    this.rooms.set(code, r);
    const p = this.addPlayer(r, ws, name, kind, accountId);
    r.host = p.pid;
    this.log.log(`room ${code} created by ${p.name}`);
    return { room: r, player: p };
  }
  join(ws: WebSocket, code: unknown, name: unknown, kind: unknown, gen?: unknown, accountId?: string) {
    const r = this.rooms.get(String(code ?? '').trim());
    if (!r) throw new RoomError('NOT_FOUND', 'Комната не найдена');
    if (RoomsService.cleanGen(gen) !== (r.gen || '')) throw new RoomError('GEN', 'Обнови страницу');
    if (r.phase === 'play') throw new RoomError('IN_GAME', 'Забег уже идёт');
    if (r.players.length >= MAX_PLAYERS) throw new RoomError('FULL', 'Комната заполнена');
    const p = this.addPlayer(r, ws, name, kind, accountId);
    this.log.log(`room ${r.code}: ${p.name} joined (${r.players.length}/${MAX_PLAYERS})`);
    return { room: r, player: p };
  }
  resume(ws: WebSocket, token: unknown) {
    const hit = this.byToken.get(String(token ?? ''));
    if (!hit || !this.rooms.has(hit.room.code)) throw new RoomError('NO_SESSION', 'Сессия истекла');
    const { room, player } = hit;
    if (player.ws && player.ws !== ws) try { player.ws.close(4001, 'replaced'); } catch { /* ignore */ }
    player.ws = ws; player.offSince = 0;
    room.touched = Date.now();
    this.log.log(`room ${room.code}: ${player.name} resumed`);
    return hit;
  }
  addBot(r: Room, p: Player) {
    if (p.pid !== r.host) throw new RoomError('NOT_HOST', 'Только хост');
    if (r.phase !== 'lobby') throw new RoomError('IN_GAME', 'Забег уже идёт');
    if (r.players.length >= MAX_PLAYERS) throw new RoomError('FULL', 'Комната заполнена');
    const used = new Set(r.players.map((q) => q.kind));
    let kind = 0;
    for (let k = 0; k < HERO_COUNT; k++) if (!used.has(k)) { kind = k; break; }
    /* Bots are numbered «БОТ 1..3» (lowest free number) so lobby, game and the evening score can tell them apart. */
    const usedNo = new Set(r.players.filter((q) => q.bot).map((q) => Number(String(q.name).replace(/\D+/g, '')) || 0));
    let no = 1;
    while (usedNo.has(no)) no++;
    const bot = this.addPlayer(r, null as unknown as WebSocket, 'БОТ ' + no, kind);
    bot.bot = true;
    bot.ready = true;
    bot.ws = null;
    this.log.log(`room ${r.code}: bot ${bot.name} added`);
    return bot;
  }
  kick(r: Room, by: Player, pid: unknown) {
    if (by.pid !== r.host) throw new RoomError('NOT_HOST', 'Только хост');
    if (r.phase !== 'lobby') throw new RoomError('IN_GAME', 'Сначала дождись конца забега');
    const id = Math.floor(Number(pid));
    const t = r.players.find((q) => q.pid === id);
    if (!t || t.pid === r.host) throw new RoomError('BAD_PID', 'Некого выгнать');
    if (!t.bot && t.ws) {
      const sock = t.ws as WebSocket & { sess?: Sess };
      this.send(t.ws, 'kicked', { code: r.code, msg: 'Тебя выгнали из комнаты' });
      if (sock.sess) { sock.sess.room = undefined; sock.sess.player = undefined; }
      t.ws = null;
    }
    this.byToken.delete(t.token);
    this.remove(r, t);
  }
  setReady(r: Room, p: Player, ready: unknown) {
    if (r.phase !== 'lobby') return;
    p.ready = !!ready;
  }
  setHero(r: Room, p: Player, kind: unknown) {
    if (r.phase !== 'lobby') return;
    p.kind = RoomsService.cleanKind(kind);
  }
  setMap(r: Room, p: Player, map: unknown) {
    if (p.pid !== r.host || r.phase !== 'lobby') throw new RoomError('NOT_HOST', 'Только хост');
    if (!MAPS.includes(String(map))) throw new RoomError('BAD_MAP', 'Нет такой карты');
    r.map = String(map);
  }
  start(r: Room, p: Player) {
    if (p.pid !== r.host) throw new RoomError('NOT_HOST', 'Только хост');
    if (r.phase === 'play') throw new RoomError('IN_GAME', 'Забег уже идёт');
    const others = r.players.filter((q) => q.pid !== r.host && !q.offSince && !q.bot);
    if (others.some((q) => !q.ready)) throw new RoomError('NOT_READY', 'Не все готовы');
    r.phase = 'play';
    r.round++;
    r.seed = randomInt(1, 0x7fffffff);
    r.startAt = Date.now() + START_DELAY_MS;
    for (const q of r.players) { q.dead = !!q.offSince; q.m = 0; q.st = null; q.stDirty = false; q.suspicious = 0; }
    r.touched = Date.now();
    this.broadcast(r, 'start', this.startView(r));
    if (r.snapTimer) clearInterval(r.snapTimer);
    r.snapTimer = setInterval(() => this.snap(r), Math.round(1000 / SNAP_HZ));
    this.log.log(`room ${r.code}: round ${r.round} started, seed ${r.seed}, map ${r.map}, ${r.players.length} players`);
  }
  startView(r: Room) {
    return { round: r.round, seed: r.seed, map: r.map, lw: r.lw, at: r.startAt, players: r.players.map((q) => this.info(q)) };
  }

  /* ---------- in-run relay ---------- */
  /** Light validation: finite numbers, sane ranges, monotone height. Cheating is future work (see README). */
  state(r: Room, p: Player, d: any) {
    let who = p;
    if (d && d.b != null) {
      const id = Math.floor(Number(d.b));
      const bot = r.players.find((q) => q.pid === id && q.bot);
      if (p.pid !== r.host || !bot) return;
      who = bot;
    }
    if (r.phase !== 'play' || who.dead || !d) return;
    const num = (v: unknown, lo: number, hi: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : NaN;
    };
    const x = num(d.x, -40, r.lw + 40), y = num(d.y, -1e7, 1e4);
    if (Number.isNaN(x) || Number.isNaN(y)) return;
    const vx = num(d.vx, -20, 20) || 0, vy = num(d.vy, -20, 20) || 0;
    const f = Number(d.f) < 0 ? -1 : 1, a = d.a === 0 || d.a === false ? 0 : 1;
    let m = num(d.m, 0, 1e7) || 0;
    const now = Date.now();
    if (who.st && who.lastStAt) {
      const dt = Math.max(0.02, (now - who.lastStAt) / 1000);
      // fastest legit climb (rocket) ~ 410 px/s; teleport ~ 300 px one-off. Flag, don't reject.
      if (who.st[1] - y > 900 * dt + 400) who.suspicious++;
    }
    if (m < who.m) m = who.m; // height can't go down
    who.m = Math.max(who.m, Math.floor(m / 8));
    who.st = [Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(vx * 100) / 100, Math.round(vy * 100) / 100, f, a, Math.round(m), (Number(d.ps) | 0) & 0xffff];
    who.stDirty = true;
    who.lastStAt = now;
  }
  /** Host packs every bot into one message so the flood guard stays comfortable. */
  botsState(r: Room, p: Player, d: any) {
    if (p.pid !== r.host || !d || !Array.isArray(d.s)) return;
    for (const row of d.s.slice(0, MAX_PLAYERS)) this.state(r, p, row);
  }
  event(r: Room, p: Player, d: any) {
    if (r.phase !== 'play' || !d || typeof d.e !== 'string') return;
    const e = d.e;
    if (e === 'dead') {
      let who = p;
      if (d.b != null) {
        const bot = r.players.find((q) => q.pid === Math.floor(Number(d.b)) && q.bot);
        if (p.pid !== r.host || !bot) return;
        who = bot;
      }
      if (who.dead) return;
      who.dead = true;
      const m = Number(d.m);
      if (Number.isFinite(m)) who.m = Math.max(who.m, Math.min(1e6, Math.floor(m)));
      this.broadcast(r, 'ev', { pid: who.pid, e: 'dead', m: who.m, why: String(d.why || '').slice(0, 8) }, p.pid);
      this.maybeFinish(r);
    } else if (e === 'mob' && typeof d.id === 'string' && d.id.length < 40) {
      this.broadcast(r, 'ev', { pid: p.pid, e: 'mob', id: d.id }, p.pid);
    } else if ((e === 'pick' || e === 'ab') && typeof d.k === 'string' && d.k.length < 20) {
      this.broadcast(r, 'ev', { pid: p.pid, e, k: d.k }, p.pid);
    } else if ((e === 'coin' || e === 'item') && Number.isFinite(Number(d.i))) {
      const i = Math.floor(Number(d.i));
      if (i < 0 || i > 1e6) return;
      this.broadcast(r, 'ev', { pid: p.pid, e, i }, p.pid);
    } else if (e === 'brk') {
      const id = Math.floor(Number(d.id));
      if (!Number.isFinite(id) || id < 0 || id > 1e7) return;
      const kind = d.k === 'lava' || d.k === 'bubble' || d.k === 'break' ? d.k : 'break';
      if (!r.broken) r.broken = new Map();
      if (r.broken.has(id)) return;
      this.broadcast(r, 'ev', { pid: p.pid, e: 'brk', id, k: kind }, p.pid);
      /* Lava stays gone, matching solo. Bubbles return together after 75 ticks (1500 ms). */
      const ms = kind === 'bubble' ? 1500 : kind === 'lava' ? 0 : BREAK_RESTORE_MS;
      if (ms <= 0) return;
      const timer = setTimeout(() => {
        if (!this.rooms.has(r.code)) return;
        r.broken.delete(id);
        this.broadcast(r, 'ev', { pid: p.pid, e: 'rst', id });
      }, ms);
      r.broken.set(id, timer);
    }
  }
  private snap(r: Room) {
    if (r.phase !== 'play') return;
    const s: any[] = [];
    for (const p of r.players) if (p.st && p.stDirty) { s.push([p.pid, ...p.st]); p.stDirty = false; }
    if (!s.length) return;
    stats.snaps++;
    this.broadcast(r, 'snap', { ts: Date.now(), s });
  }
  private maybeFinish(r: Room) {
    if (r.phase !== 'play') return;
    if (r.players.some((p) => !p.dead)) return;
    r.phase = 'results';
    if (r.snapTimer) { clearInterval(r.snapTimer); r.snapTimer = null; }
    this.snap(r);
    const ranking = r.players
      .slice().sort((a, b) => b.m - a.m)
      .map((p, i) => ({ pid: p.pid, name: p.name, kind: p.kind, m: p.m, place: i + 1 }));
    this.broadcast(r, 'results', { round: r.round, ranking });
    this.log.log(`room ${r.code}: round ${r.round} results ${ranking.map((x) => x.name + ':' + x.m).join(', ')}`);
    // back to lobby for the rematch
    r.phase = 'lobby';
    /* Bots are always ready; only people re-confirm for the rematch. */
    for (const p of r.players) p.ready = !!p.bot;
    this.pushRoom(r);
  }

  /* ---------- leaving / reconnect / cleanup ---------- */
  disconnected(ws: WebSocket, s: Sess) {
    const { room: r, player: p } = s;
    if (!r || !p || p.ws !== ws) return;
    p.ws = null;
    p.offSince = Date.now();
    this.log.log(`room ${r.code}: ${p.name} disconnected, grace ${RECONNECT_GRACE_MS / 1000}s`);
    this.pushRoom(r);
  }
  leave(s: Sess) {
    const { room: r, player: p } = s;
    if (!r || !p) return;
    this.remove(r, p);
    s.room = undefined; s.player = undefined;
  }
  private remove(r: Room, p: Player) {
    const wasHost = r.host === p.pid;
    r.players = r.players.filter((q) => q !== p);
    this.byToken.delete(p.token);
    if (wasHost) {
      for (const b of r.players.filter((q) => q.bot)) {
        r.players = r.players.filter((q) => q !== b);
        this.byToken.delete(b.token);
        this.broadcast(r, 'ev', { pid: b.pid, e: 'left' });
      }
    }
    if (!r.players.length) { this.destroy(r); return; }
    if (wasHost) {
      const live = r.players.find((q) => !q.offSince) || r.players[0];
      r.host = live.pid;
    }
    this.broadcast(r, 'ev', { pid: p.pid, e: 'left' });
    if (r.phase === 'play') this.maybeFinish(r);
    if (this.rooms.has(r.code)) this.pushRoom(r);
  }
  private destroy(r: Room) {
    if (r.snapTimer) clearInterval(r.snapTimer);
    if (r.broken) for (const t of r.broken.values()) clearTimeout(t);
    for (const p of r.players) this.byToken.delete(p.token);
    this.rooms.delete(r.code);
    this.log.log(`room ${r.code} closed`);
  }
  sweep(now = Date.now()) {
    for (const r of [...this.rooms.values()]) {
      // AFK guard: a runner that stopped sending state for 15 s is counted as fallen, so the round can end
      if (r.phase === 'play' && now - r.startAt > 15_000) {
        for (const p of r.players) {
          if (!p.dead && !p.offSince && now - Math.max(p.lastStAt, r.startAt) > STALE_MS) {
            p.dead = true;
            this.broadcast(r, 'ev', { pid: p.pid, e: 'dead', m: p.m, why: 'afk' }, p.pid);
          }
        }
        this.maybeFinish(r);
      }
      for (const p of [...r.players]) {
        if (!p.bot && p.offSince && now - p.offSince > RECONNECT_GRACE_MS) {
          this.log.log(`room ${r.code}: ${p.name} dropped (no reconnect)`);
          if (r.phase === 'play' && !p.dead) p.dead = true;
          this.remove(r, p);
        }
      }
      if (this.rooms.has(r.code) && now - r.touched > ROOM_IDLE_MS) this.destroy(r);
    }
  }
}
