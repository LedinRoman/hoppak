import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomBytes, randomInt } from 'crypto';
import type { WebSocket } from 'ws';
import {
  FieldConfig, STALE_MS, HERO_COUNT, MAPS, MAX_PLAYERS, Phase, PlayerInfo, RECONNECT_GRACE_MS, ROOM_IDLE_MS, SNAP_HZ, START_DELAY_MS, loadFieldConfig, loadV1FieldWidth,
} from './protocol';

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
}

export interface Room {
  code: string;
  host: number;
  phase: Phase;
  map: string;
  proto: number;
  lw: number;
  field: FieldConfig;
  round: number;
  seed: number;
  startAt: number;
  players: Player[];
  nextPid: number;
  touched: number;
  snapTimer: NodeJS.Timeout | null;
  drainCloseAt?: number;
}

export class RoomError extends Error {
  constructor(public code: string, msg: string) { super(msg); }
}

/** Per-socket session data, stored on the ws object. */
export interface Sess { room?: Room; player?: Player; win: number; winN: number; }

export const stats = { msgsIn: 0, msgsOut: 0, bytesOut: 0, snaps: 0 };

@Injectable()
export class RoomsService implements OnModuleDestroy {
  private readonly log = new Logger('Rooms');
  readonly rooms = new Map<string, Room>();
  private readonly byToken = new Map<string, { room: Room; player: Player }>();
  readonly v2Field: FieldConfig = loadFieldConfig();
  readonly v1FieldWidth: number = loadV1FieldWidth();
  onRoomFinished?: (r: Room) => void;
  onDrainExpire?: (r: Room) => void;
  private sweeper = setInterval(() => this.sweep(), 500);

  onModuleDestroy() {
    clearInterval(this.sweeper);
    for (const r of this.rooms.values()) if (r.snapTimer) clearInterval(r.snapTimer);
  }

  /* ---------- helpers ---------- */
  static cleanName(s: unknown, kind: number) {
    const t = String(s ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 10);
    return t || 'ИГРОК' + (kind + 1);
  }
  static cleanKind(k: unknown) {
    const n = Number(k);
    return Number.isInteger(n) && n >= 0 && n < HERO_COUNT ? n : 0;
  }
  info(p: Player): PlayerInfo {
    return { pid: p.pid, slot: p.slot, name: p.name, kind: p.kind, ready: p.ready, on: !p.offSince };
  }
  roomView(r: Room, p: Player) {
    return {
      code: r.code, you: p.pid, token: p.token, host: r.host, phase: r.phase, map: r.map, lw: r.lw,
      ...(r.proto >= 2 ? { field: r.field } : {}),
      round: r.round,
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

  private codeRange(): [number, number] {
    const envMin = Number(process.env.ROOM_CODE_MIN);
    const envMax = Number(process.env.ROOM_CODE_MAX);
    if (Number.isInteger(envMin) && Number.isInteger(envMax) && envMin >= 1000 && envMax <= 9999 && envMin <= envMax) {
      return [envMin, envMax];
    }
    const node = (process.env.NODE_NAME || '').trim().toLowerCase();
    if (node === 'blue') return [1000, 5499];
    if (node === 'green') return [5500, 9999];
    return [1000, 9999];
  }
  private newCode() {
    const [lo, hi] = this.codeRange();
    const span = hi - lo + 1;
    for (let i = 0; i < 200; i++) {
      const c = String(randomInt(lo, hi + 1));
      if (!this.rooms.has(c)) return c;
    }
    const start = randomInt(0, span);
    for (let i = 0; i < span; i++) {
      const c = String(lo + ((start + i) % span));
      if (!this.rooms.has(c)) return c;
    }
    throw new RoomError('BUSY', 'no free room codes');
  }
  private freeSlot(r: Room) {
    for (let s = 0; s < MAX_PLAYERS; s++) if (!r.players.some((p) => p.slot === s)) return s;
    return -1;
  }
  private addPlayer(r: Room, ws: WebSocket, name: unknown, kind: unknown): Player {
    const k = RoomsService.cleanKind(kind);
    const p: Player = {
      pid: r.nextPid++, slot: this.freeSlot(r), name: RoomsService.cleanName(name, k), kind: k, ready: false,
      token: randomBytes(12).toString('base64url'), ws, offSince: 0, st: null, stDirty: false, lastStAt: 0,
      dead: false, m: 0, suspicious: 0,
    };
    r.players.push(p);
    this.byToken.set(p.token, { room: r, player: p });
    r.touched = Date.now();
    return p;
  }

  /* ---------- lobby ---------- */
  private fieldForProtocol(proto: number): FieldConfig {
    if (proto >= 2) return { ...this.v2Field };
    return { w: this.v1FieldWidth, h: 346, pxPerM: 8 };
  }
  create(ws: WebSocket, name: unknown, kind: unknown, proto = 1) {
    const code = this.newCode();
    const roomProto = proto >= 2 ? 2 : 1;
    const field = this.fieldForProtocol(roomProto);
    const r: Room = {
      code, host: 0, phase: 'lobby', map: 'city', proto: roomProto, lw: field.w, field, round: 0, seed: 0, startAt: 0, players: [], nextPid: 0,
      touched: Date.now(), snapTimer: null,
    };
    this.rooms.set(code, r);
    const p = this.addPlayer(r, ws, name, kind);
    r.host = p.pid;
    this.log.log(`room ${code} created by ${p.name}`);
    return { room: r, player: p };
  }
  join(ws: WebSocket, code: unknown, name: unknown, kind: unknown, proto = 1) {
    const r = this.rooms.get(String(code ?? '').trim());
    if (!r) throw new RoomError('NOT_FOUND', 'Комната не найдена');
    const clientProto = proto >= 2 ? 2 : 1;
    if (r.proto !== clientProto) {
      throw new RoomError(
        'PROTOCOL_MISMATCH',
        clientProto < r.proto ? 'Обновите игру для входа' : 'Друг на старой версии',
      );
    }
    if (r.phase === 'play') throw new RoomError('IN_GAME', 'Забег уже идёт');
    if (r.players.length >= MAX_PLAYERS) throw new RoomError('FULL', 'Комната заполнена');
    const p = this.addPlayer(r, ws, name, kind);
    this.log.log(`room ${r.code}: ${p.name} joined (${r.players.length}/${MAX_PLAYERS})`);
    return { room: r, player: p };
  }
  findToken(token: unknown) {
    const hit = this.byToken.get(String(token ?? ''));
    if (!hit || !this.rooms.has(hit.room.code)) return null;
    return hit;
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
    const others = r.players.filter((q) => q.pid !== r.host && !q.offSince);
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
    return {
      round: r.round, seed: r.seed, map: r.map, lw: r.lw,
      ...(r.proto >= 2 ? { field: r.field } : {}),
      at: r.startAt, players: r.players.map((q) => this.info(q)),
    };
  }

  /* ---------- in-run relay ---------- */
  /** Light validation: finite numbers, sane ranges, monotone height. Cheating is future work (see README). */
  state(r: Room, p: Player, d: any) {
    if (r.phase !== 'play' || p.dead || !d) return;
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
    if (p.st && p.lastStAt) {
      const dt = Math.max(0.02, (now - p.lastStAt) / 1000);
      // fastest legit climb (rocket) ~ 410 px/s; teleport ~ 300 px one-off. Flag, don't reject.
      if (p.st[1] - y > 900 * dt + 400) p.suspicious++;
    }
    if (m < p.m) m = p.m; // height can't go down
    p.m = Math.max(p.m, Math.floor(m / (r.field?.pxPerM || 8)));
    p.st = [Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(vx * 100) / 100, Math.round(vy * 100) / 100, f, a, Math.round(m), (Number(d.ps) | 0) & 0xffff];
    p.stDirty = true;
    p.lastStAt = now;
  }
  event(r: Room, p: Player, d: any) {
    if (r.phase !== 'play' || !d || typeof d.e !== 'string') return;
    const e = d.e;
    if (e === 'dead') {
      if (p.dead) return;
      p.dead = true;
      const m = Number(d.m);
      if (Number.isFinite(m)) p.m = Math.max(p.m, Math.min(1e6, Math.floor(m)));
      this.broadcast(r, 'ev', { pid: p.pid, e: 'dead', m: p.m, why: String(d.why || '').slice(0, 8) }, p.pid);
      this.maybeFinish(r);
    } else if (e === 'mob' && typeof d.id === 'string' && d.id.length < 40) {
      this.broadcast(r, 'ev', { pid: p.pid, e: 'mob', id: d.id }, p.pid);
    } else if ((e === 'pick' || e === 'ab') && typeof d.k === 'string' && d.k.length < 20) {
      this.broadcast(r, 'ev', { pid: p.pid, e, k: d.k }, p.pid);
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
  private finishRound(r: Room, forced = false) {
    r.phase = 'results';
    if (r.snapTimer) { clearInterval(r.snapTimer); r.snapTimer = null; }
    this.snap(r);
    const ranking = r.players
      .slice().sort((a, b) => b.m - a.m)
      .map((p, i) => ({ pid: p.pid, name: p.name, kind: p.kind, m: p.m, place: i + 1 }));
    this.broadcast(r, 'results', { round: r.round, ranking });
    this.log.log(`room ${r.code}: round ${r.round} ${forced ? 'forced ' : ''}results ${ranking.map((x) => x.name + ':' + x.m).join(', ')}`);
    if (forced) return;
    // back to lobby for the rematch
    r.phase = 'lobby';
    for (const p of r.players) p.ready = false;
    this.pushRoom(r);
    this.onRoomFinished?.(r);
  }
  private maybeFinish(r: Room) {
    if (r.phase !== 'play') return;
    if (r.players.some((p) => !p.dead)) return;
    this.finishRound(r, false);
  }
  forceFinishAll(reasonCode = 'SERVER_SHUTDOWN', msg = 'Сервер перезагружается') {
    for (const r of [...this.rooms.values()]) {
      if (r.phase === 'play') {
        this.finishRound(r, true);
        this.broadcast(r, 'err', { code: reasonCode, msg });
      }
      this.destroyRoom(r);
    }
  }
  destroyRoom(r: Room) {
    for (const p of r.players) {
      const ws: any = p.ws;
      if (ws && ws.sess && ws.sess.room === r) {
        ws.sess.room = undefined;
        ws.sess.player = undefined;
      }
    }
    this.destroy(r);
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
    r.players = r.players.filter((q) => q !== p);
    this.byToken.delete(p.token);
    if (!r.players.length) { this.destroy(r); return; }
    if (r.host === p.pid) {
      const live = r.players.find((q) => !q.offSince) || r.players[0];
      r.host = live.pid;
    }
    this.broadcast(r, 'ev', { pid: p.pid, e: 'left' });
    if (r.phase === 'play') this.maybeFinish(r);
    if (this.rooms.has(r.code)) this.pushRoom(r);
  }
  private destroy(r: Room) {
    if (r.snapTimer) clearInterval(r.snapTimer);
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
        if (p.offSince && now - p.offSince > RECONNECT_GRACE_MS) {
          this.log.log(`room ${r.code}: ${p.name} dropped (no reconnect)`);
          if (r.phase === 'play' && !p.dead) p.dead = true;
          this.remove(r, p);
        }
      }
      if (this.rooms.has(r.code) && r.drainCloseAt && now >= r.drainCloseAt) {
        if (this.onDrainExpire) this.onDrainExpire(r);
        else this.destroyRoom(r);
        continue;
      }
      if (this.rooms.has(r.code) && now - r.touched > ROOM_IDLE_MS) this.destroy(r);
    }
  }
}
