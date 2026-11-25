import { INestApplication, Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import type { IncomingMessage } from 'http';
import { join } from 'path';
import WebSocket from 'ws';
import { FieldConfig, MIN_PROTOCOL_VERSION, PROTOCOL_VERSION, loadFieldConfig } from '../protocol';
import { MigratedRoom, Room, RoomError, RoomsService, Sess } from '../rooms.service';

export type TrackedSocket = WebSocket & {
  sess: Sess & {
    protocol?: number;
    unsupported?: boolean;
    proxied?: boolean;
    upstream?: WebSocket;
    proxyQueue?: (string | Buffer)[];
    /** socket arrived over /internal/ws from the peer slot (it fronts a real client there) */
    internal?: boolean;
    /** set while we tear the proxy down on purpose, so the client socket stays open (BUG-44) */
    detaching?: boolean;
  };
};

/** FONT-safe (Cyrillic, '.', '!'), <= 24 chars: what an old v1 client shows when it cannot be moved. */
export const V1_MOVE_FAIL_MSG = 'Другая версия. Обновите!';
export const SHUTDOWN_MSG = 'Сервер перезагружается';

export type PeerAuth = 'unknown' | 'ok' | 'unauthorized' | 'unreachable' | 'none';

export interface PeerStats {
  rooms: number;
  players: number;
  draining: boolean;
  shuttingDown?: boolean;
  node: string;
  version: string;
}

export interface PeerRoomCheck {
  exists: boolean;
  code: string;
  node: string;
  phase?: string;
  proto?: number;
  lw?: number;
  field?: FieldConfig;
  players?: number;
}

export interface PeerTokenCheck {
  exists: boolean;
  code: string;
  node: string;
}

export type ProtocolNegotiation =
  | { ok: true; protocol: number }
  | { ok: false; requested: number | null; code: string; msg: string };

function readPackageVersion(): string {
  const candidates = [
    join(__dirname, '..', '..', 'package.json'),
    join(__dirname, '..', 'package.json'),
    join(process.cwd(), 'package.json'),
  ];
  for (const p of candidates) {
    try {
      if (!existsSync(p)) continue;
      const raw = JSON.parse(readFileSync(p, 'utf8'));
      if (raw && typeof raw.version === 'string' && raw.version.trim()) return raw.version.trim();
    } catch {
      /* ignore */
    }
  }
  return '0.0.0';
}

function parsePositiveMs(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

@Injectable()
export class BlueGreenService {
  private readonly log = new Logger('BlueGreen');
  readonly node: string;
  readonly version: string;
  readonly peerInternalUrl: string;
  readonly peerNodeFallback: string;
  readonly internalToken: string;
  readonly peerTimeoutMs: number;
  readonly drainLobbyTtlMs: number;
  readonly drainResultsCloseMs: number;
  readonly gracefulShutdownMs: number;
  readonly field: FieldConfig;

  draining = false;
  shuttingDown = false;
  announcedVersion: string | null = null;
  readonly migrateGraceMs: number;
  peerAuth: PeerAuth = 'unknown';
  private lastAuthLogAt = 0;
  /** token -> where its room moved (old slot keeps this for late reconnects, BUG-35) */
  private readonly moved = new Map<string, { node: string; code: string; until: number }>();
  private peerAuthTimer: NodeJS.Timeout | null = null;

  private readonly clients = new Set<TrackedSocket>();
  private roomsService: RoomsService | null = null;
  private internalWsHandler: ((ws: TrackedSocket, req: IncomingMessage) => void) | null = null;

  constructor() {
    this.node = (process.env.NODE_NAME || 'local').trim() || 'local';
    this.version = (process.env.APP_VERSION || '').trim() || readPackageVersion();
    this.peerInternalUrl = (process.env.PEER_INTERNAL_URL || '').trim().replace(/\/+$/, '');
    this.peerNodeFallback = (
      process.env.PEER_NODE_NAME ||
      (this.node === 'blue' ? 'green' : this.node === 'green' ? 'blue' : '')
    ).trim();
    this.internalToken = (process.env.INTERNAL_TOKEN || '').trim();
    this.peerTimeoutMs = parsePositiveMs(process.env.PEER_TIMEOUT_MS, 800);
    this.drainLobbyTtlMs = parsePositiveMs(process.env.DRAIN_LOBBY_TTL_MS, 15_000);
    this.drainResultsCloseMs = parsePositiveMs(process.env.DRAIN_RESULTS_CLOSE_MS, 1_500);
    this.gracefulShutdownMs = parsePositiveMs(process.env.GRACEFUL_SHUTDOWN_MS, 25_000);
    this.field = loadFieldConfig();
    this.migrateGraceMs = parsePositiveMs(process.env.MIGRATE_GRACE_MS, 30_000);
    if (!this.peerInternalUrl) this.peerAuth = 'none';
    else {
      const t = setTimeout(() => void this.checkPeerAuth(), 300);
      t.unref();
      this.peerAuthTimer = setInterval(() => void this.checkPeerAuth(), 30_000);
      this.peerAuthTimer.unref();
    }
  }

  /** Track the peer's answer to our INTERNAL_TOKEN; log loudly on change (BUG-48). */
  private notePeerStatus(status: number | 'error', what: string) {
    const next: PeerAuth = status === 401 || status === 403 ? 'unauthorized' : status === 'error' ? 'unreachable' : 'ok';
    const prev = this.peerAuth;
    this.peerAuth = next;
    const now = Date.now();
    if (next === 'unauthorized' && (prev !== 'unauthorized' || now - this.lastAuthLogAt > 10_000)) {
      this.lastAuthLogAt = now;
      this.log.error(`peer ${this.peerInternalUrl} rejected INTERNAL_TOKEN (401) on ${what}: INTERNAL_TOKEN differs between slots? proxy/redirect/migration will not work`);
    } else if (prev !== next && next === 'ok') {
      this.log.log(`peer ${this.peerInternalUrl} accepts our INTERNAL_TOKEN (peerAuth=ok)`);
    } else if (prev !== next && next === 'unreachable') {
      this.log.warn(`peer ${this.peerInternalUrl} unreachable (${what})`);
    }
  }

  async checkPeerAuth() {
    if (!this.peerInternalUrl) return;
    await this.lookupPeerStats();
  }

  private internalHeaders(): Record<string, string> {
    return this.internalToken ? { 'x-internal-token': this.internalToken } : {};
  }

  bindRooms(rooms: RoomsService) {
    this.roomsService = rooms;
    rooms.onRoomFinished = (r) => {
      if (this.draining || this.shuttingDown) {
        r.drainCloseAt = Date.now() + (this.shuttingDown ? 150 : this.drainResultsCloseMs);
      }
    };
    rooms.onDrainExpire = (r) => {
      void this.migrateRoom(r);
    };
  }

  setInternalWsHandler(fn: (ws: TrackedSocket, req: IncomingMessage) => void) {
    this.internalWsHandler = fn;
  }

  handleInternalWs(ws: TrackedSocket, req: IncomingMessage) {
    this.internalWsHandler?.(ws, req);
  }

  registerClient(ws: TrackedSocket) {
    this.clients.add(ws);
  }

  unregisterClient(ws: TrackedSocket) {
    this.clients.delete(ws);
  }

  negotiateProtocol(rawUrl?: string): ProtocolNegotiation {
    let pParam: string | null = null;
    if (rawUrl) {
      try {
        const u = new URL(rawUrl, 'http://localhost');
        pParam = u.searchParams.get('p');
      } catch {
        pParam = null;
      }
    }
    if (pParam === null || pParam === '') {
      if (MIN_PROTOCOL_VERSION <= 1 && PROTOCOL_VERSION >= 1) {
        return { ok: true, protocol: 1 };
      }
      return {
        ok: false,
        requested: 1,
        code: 'UNSUPPORTED_PROTOCOL',
        msg: 'Онлайн недоступен, обновитесь',
      };
    }
    const parsed = Number(pParam);
    if (!Number.isInteger(parsed) || parsed < MIN_PROTOCOL_VERSION || parsed > PROTOCOL_VERSION) {
      return {
        ok: false,
        requested: Number.isFinite(parsed) ? parsed : null,
        code: 'UNSUPPORTED_PROTOCOL',
        msg: 'Онлайн недоступен, обновитесь',
      };
    }
    return { ok: true, protocol: parsed };
  }

  buildHello(protocol: number) {
    if (protocol <= 1) {
      return { v: 1, s: Date.now(), node: this.node };
    }
    return {
      v: protocol,
      s: Date.now(),
      node: this.node,
      version: this.version,
      field: this.roomsService ? this.roomsService.v2Field : this.field,
    };
  }

  healthFields() {
    return {
      version: this.version,
      protocol: PROTOCOL_VERSION,
      minProtocol: MIN_PROTOCOL_VERSION,
      node: this.node,
      draining: this.draining,
      shuttingDown: this.shuttingDown,
      peerAuth: this.peerAuth,
    };
  }

  getStats() {
    const roomsMap = this.roomsService?.rooms;
    const rooms = roomsMap ? roomsMap.size : 0;
    const players = roomsMap
      ? [...roomsMap.values()].reduce((n, r) => n + r.players.length, 0)
      : 0;
    return {
      rooms,
      players,
      connections: this.clients.size,
      draining: this.draining,
      shuttingDown: this.shuttingDown,
      node: this.node,
      version: this.version,
      protocol: PROTOCOL_VERSION,
      minProtocol: MIN_PROTOCOL_VERSION,
      uptime: Math.round(process.uptime()),
    };
  }

  checkRoom(code: string): PeerRoomCheck | null {
    const clean = String(code ?? '').trim();
    const room = this.roomsService?.rooms.get(clean);
    if (!room) return null;
    return {
      exists: true,
      code: room.code,
      node: this.node,
      phase: room.phase,
      proto: room.proto,
      lw: room.lw,
      players: room.players.length,
    };
  }

  checkToken(token: string): PeerTokenCheck | null {
    const hit = this.roomsService?.findToken(token);
    if (!hit) return null;
    return {
      exists: true,
      code: hit.room.code,
      node: this.node,
    };
  }

  private sendToSocket(ws: WebSocket, event: string, data: unknown) {
    if (this.roomsService) {
      this.roomsService.send(ws, event, data);
    } else if (ws.readyState === 1) {
      ws.send(JSON.stringify({ event, data }));
    }
  }

  notifyClientOnConnect(ws: TrackedSocket) {
    const proto = ws.sess?.protocol ?? 1;
    if (proto >= 2 && this.announcedVersion) {
      this.sendToSocket(ws, 'update', { version: this.announcedVersion });
    }
  }

  announceUpdate(version?: string): { version: string; notified: number } {
    const ver = (version || '').trim() || this.version;
    if (version && version.trim()) {
      this.announcedVersion = version.trim();
    }
    let notified = 0;
    for (const ws of this.clients) {
      const proto = ws.sess?.protocol ?? 1;
      if (proto >= 2 && !ws.sess?.unsupported && !ws.sess?.proxied && ws.readyState === 1) {
        this.sendToSocket(ws, 'update', { version: ver });
        notified++;
      }
    }
    this.log.log(`update(${ver}) announced to ${notified} v2+ client(s)`);
    return { version: ver, notified };
  }

  async drain(version?: string) {
    this.draining = true;
    const now = Date.now();
    if (this.roomsService) {
      for (const r of this.roomsService.rooms.values()) {
        if (r.phase === 'lobby' && !r.drainCloseAt) {
          r.drainCloseAt = now + (r.round > 0 ? this.drainResultsCloseMs : this.drainLobbyTtlMs);
        }
      }
    }
    let targetVersion = (version || '').trim();
    if (!targetVersion && this.peerInternalUrl) {
      const peer = await this.lookupPeerStats();
      if (peer && peer.version && peer.version !== this.version) {
        targetVersion = peer.version;
      }
    }
    let notified = 0;
    if (targetVersion) {
      const res = this.announceUpdate(targetVersion);
      notified = res.notified;
    }
    this.log.log(`drain enabled on node=${this.node} (version=${this.version}, update=${targetVersion || 'none'}, notified=${notified})`);
    return {
      ok: true,
      ...this.getStats(),
      updateVersion: targetVersion || null,
      notified,
    };
  }

  undrain() {
    this.draining = false;
    this.announcedVersion = null;
    if (this.roomsService) {
      for (const r of this.roomsService.rooms.values()) {
        r.drainCloseAt = undefined;
      }
    }
    this.log.log(`drain disabled on node=${this.node}`);
    return { ok: true, ...this.getStats() };
  }

  /** Where a token's room moved to (if it moved off this slot recently). */
  movedTo(token: string): { node: string; code: string } | null {
    const t = String(token ?? '').trim();
    const hit = this.moved.get(t);
    if (!hit) return null;
    if (Date.now() > hit.until) { this.moved.delete(t); return null; }
    return { node: hit.node, code: hit.code };
  }

  /** POST /internal/rooms/import on this slot: re-create a room moved from the peer. */
  importRoom(body: any): { ok: true; code: string; node: string } {
    if (!this.roomsService) throw new RoomError('NOT_READY', 'not ready');
    if (this.draining || this.shuttingDown) throw new RoomError('DRAINING', 'this slot is draining');
    const r = this.roomsService.importRoom(body as MigratedRoom, this.migrateGraceMs);
    return { ok: true, code: r.code, node: this.node };
  }

  private async postPeerImport(snapshot: MigratedRoom): Promise<{ code: string; node: string } | null> {
    if (!this.peerInternalUrl) return null;
    try {
      const res = await fetch(`${this.peerInternalUrl}/internal/rooms/import`, {
        method: 'POST',
        headers: { ...this.internalHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify(snapshot),
        signal: AbortSignal.timeout(Math.max(this.peerTimeoutMs, 1500)),
      });
      this.notePeerStatus(res.status, 'rooms/import');
      if (!res.ok) {
        this.log.warn(`peer refused room import (${res.status}): ${await res.text().catch(() => '')}`);
        return null;
      }
      const b = (await res.json()) as any;
      return b && b.ok && b.code && b.node ? { code: String(b.code), node: String(b.node) } : null;
    } catch (err) {
      this.notePeerStatus('error', 'rooms/import');
      this.log.warn(`room import on peer failed: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * BUG-32: move a lobby/results room from this (draining) slot to the active peer as a whole:
   * same players, pids, tokens, host and round; new code from the peer's range.
   * v2 clients get `redirect { node, code, resume: true }` and resume there with their token;
   * v1 clients (v0.56/v0.57) are transparently proxied to the peer (they just see `room` with the new code).
   * If the peer can't take it, every client gets a readable error and a clean close (BUG-43).
   */
  async migrateRoom(r: Room): Promise<boolean> {
    const rooms = this.roomsService;
    if (!rooms || !rooms.rooms.has(r.code) || r.phase === 'play' || r.migrating) return false;
    r.migrating = true;
    r.drainCloseAt = undefined;
    const peerNode = await this.resolveActivePeerNode();
    let moved: { code: string; node: string } | null = null;
    if (peerNode && rooms.rooms.get(r.code) === r && (r.phase as string) !== 'play') {
      moved = await this.postPeerImport(rooms.exportRoom(r));
    }
    if (rooms.rooms.get(r.code) !== r) return false;
    if (!moved) {
      r.migrating = false;
      this.closeRoomUnmovable(r);
      return false;
    }
    const until = Date.now() + Math.max(this.migrateGraceMs * 4, 120_000);
    const players = [...r.players];
    for (const p of players) this.moved.set(p.token, { node: moved.node, code: moved.code, until });
    rooms.destroyRoom(r);
    this.log.log(`room ${r.code} moved to ${moved.node} as ${moved.code} (${players.length} players)`);
    for (const p of players) {
      const ws = p.ws as TrackedSocket | null;
      if (!ws || ws.readyState !== 1) continue;
      const proto = ws.sess?.protocol ?? 1;
      if (proto >= 2) {
        if (this.announcedVersion) this.sendToSocket(ws, 'update', { version: this.announcedVersion });
        this.sendToSocket(ws, 'redirect', { node: moved.node, code: moved.code, resume: true, reason: 'migrate' });
      } else if (ws.sess?.internal) {
        // The peer fronts this v1 client: let it reconnect there blindly; the token is already on the peer.
        try { ws.close(1012, 'room_moved'); } catch { /* ignore */ }
      } else {
        const token = p.token;
        this.proxyToPeer(ws, 'resume', { token }, { code: 'NO_SESSION', msg: V1_MOVE_FAIL_MSG }, () => this.closeWithMessage(ws, 1, false));
      }
    }
    return true;
  }

  /** Clean failure path (no live peer / import refused): readable error, then close the socket (BUG-43). */
  private closeRoomUnmovable(r: Room) {
    if (!this.roomsService) return;
    const sockets: TrackedSocket[] = [];
    for (const p of r.players) {
      const ws = p.ws as TrackedSocket | null;
      if (ws && ws.readyState === 1) sockets.push(ws);
    }
    this.roomsService.destroyRoom(r);
    for (const ws of sockets) this.closeWithMessage(ws, ws.sess?.protocol ?? 1, this.shuttingDown);
  }

  /** NO_SESSION first (client drops the room), then the friendly reason (last toast wins), then close. */
  closeWithMessage(ws: TrackedSocket, proto: number, shutdown: boolean) {
    if (ws.readyState !== 1) return;
    const msg = shutdown ? SHUTDOWN_MSG : proto >= 2 ? 'Сервер обновляется' : V1_MOVE_FAIL_MSG;
    const code = shutdown ? 'SERVER_SHUTDOWN' : 'DRAINING';
    if (proto >= 2 && this.announcedVersion) this.sendToSocket(ws, 'update', { version: this.announcedVersion });
    this.sendToSocket(ws, 'err', { code: 'NO_SESSION', msg });
    this.sendToSocket(ws, 'err', { code, msg });
    const t = setTimeout(() => { try { if (ws.readyState === 1) ws.close(1000, 'room_closed'); } catch { /* ignore */ } }, 150);
    t.unref?.();
  }

  async gracefulShutdown(app: INestApplication, signal: string) {
    if (this.shuttingDown) {
      // BUG-45: repeats are ignored; the only hard stop is the GRACEFUL_SHUTDOWN_MS timeout below.
      this.log.warn(`ignored repeated ${signal}: graceful shutdown already running (forced results at timeout)`);
      return;
    }
    this.shuttingDown = true;
    this.draining = true;
    this.log.log(`received ${signal}, starting graceful shutdown (timeout=${this.gracefulShutdownMs}ms)`);

    const failsafe = setTimeout(() => {
      this.log.error('graceful shutdown failsafe triggered, exiting');
      process.exit(1);
    }, this.gracefulShutdownMs + 5000);
    failsafe.unref();

    try {
      if (this.roomsService) {
        const rooms = this.roomsService;
        // Lobbies/results move to the peer right away (or get a readable close if there is no peer).
        for (const r of [...rooms.rooms.values()]) {
          if (r.phase !== 'play') await this.migrateRoom(r);
        }
        const deadline = Date.now() + this.gracefulShutdownMs;
        while (Date.now() < deadline) {
          // rounds that finish meanwhile get drainCloseAt (onRoomFinished) and are moved by the sweeper
          if (rooms.rooms.size === 0) break;
          await new Promise((res) => setTimeout(res, 150));
        }
        const remaining = [...rooms.rooms.values()];
        if (remaining.length > 0) {
          this.log.warn(`graceful timeout reached with ${remaining.length} room(s); sending results and closing`);
          rooms.forceFinishAll('SERVER_SHUTDOWN', SHUTDOWN_MSG);
        }
        await new Promise((res) => setTimeout(res, 250));
      }
      for (const ws of this.clients) {
        if (ws.readyState === 1) {
          try { ws.close(1001, 'server_shutdown'); } catch { /* ignore */ }
        }
      }
      await new Promise((res) => setTimeout(res, 100));
      await app.close();
    } catch (err) {
      this.log.error(`error during graceful shutdown: ${(err as Error).message}`);
    } finally {
      clearTimeout(failsafe);
      if (this.peerAuthTimer) clearInterval(this.peerAuthTimer);
      process.exit(0);
    }
  }

  async lookupPeerRoom(code: string): Promise<PeerRoomCheck | null> {
    if (!this.peerInternalUrl) return null;
    const clean = String(code ?? '').trim();
    if (!/^\d{4}$/.test(clean)) return null;
    try {
      const res = await fetch(`${this.peerInternalUrl}/internal/rooms/${encodeURIComponent(clean)}`, {
        headers: this.internalHeaders(),
        signal: AbortSignal.timeout(this.peerTimeoutMs),
      });
      this.notePeerStatus(res.status, 'rooms lookup');
      if (!res.ok) return null;
      const body = (await res.json()) as PeerRoomCheck;
      if (body && body.exists && body.node) return body;
      return null;
    } catch (err) {
      this.notePeerStatus('error', 'rooms lookup');
      this.log.warn(`peer room lookup failed (${this.peerInternalUrl}): ${(err as Error).message}`);
      return null;
    }
  }

  async lookupPeerToken(token: string): Promise<PeerTokenCheck | null> {
    if (!this.peerInternalUrl) return null;
    const clean = String(token ?? '').trim();
    if (!clean) return null;
    try {
      const res = await fetch(`${this.peerInternalUrl}/internal/tokens/${encodeURIComponent(clean)}`, {
        headers: this.internalHeaders(),
        signal: AbortSignal.timeout(this.peerTimeoutMs),
      });
      this.notePeerStatus(res.status, 'token lookup');
      if (!res.ok) return null;
      const body = (await res.json()) as PeerTokenCheck;
      if (body && body.exists && body.node) return body;
      return null;
    } catch (err) {
      this.notePeerStatus('error', 'token lookup');
      this.log.warn(`peer token lookup failed (${this.peerInternalUrl}): ${(err as Error).message}`);
      return null;
    }
  }

  async lookupPeerStats(): Promise<PeerStats | null> {
    if (!this.peerInternalUrl) return null;
    try {
      const res = await fetch(`${this.peerInternalUrl}/internal/stats`, {
        headers: this.internalHeaders(),
        signal: AbortSignal.timeout(this.peerTimeoutMs),
      });
      this.notePeerStatus(res.status, 'stats');
      if (!res.ok) return null;
      return (await res.json()) as PeerStats;
    } catch (err) {
      this.notePeerStatus('error', 'stats');
      this.log.warn(`peer stats lookup failed (${this.peerInternalUrl}): ${(err as Error).message}`);
      return null;
    }
  }

  async resolveActivePeerNode(): Promise<string | null> {
    const peer = await this.lookupPeerStats();
    if (peer) {
      return peer.draining || peer.shuttingDown ? null : peer.node;
    }
    return null;
  }

  /** BUG-44: stop proxying this client socket; following frames are handled by this slot again. */
  detachProxy(ws: TrackedSocket, lastFrame?: string | Buffer) {
    const up = ws.sess.upstream;
    ws.sess.detaching = true;
    ws.sess.proxied = false;
    ws.sess.proxyQueue = undefined;
    ws.sess.upstream = undefined;
    if (up) {
      try {
        if (lastFrame !== undefined && up.readyState === 1) up.send(lastFrame);
        if (up.readyState === 0 || up.readyState === 1) up.close(1000, 'detach');
      } catch { /* ignore */ }
    }
    ws.sess.detaching = false;
  }

  proxyToPeer(
    ws: TrackedSocket,
    initialEvent: string,
    initialData: unknown,
    fallbackError: { code: string; msg: string },
    onFail?: () => void,
  ): boolean {
    if (!this.peerInternalUrl || ws.sess.proxied || ws.readyState !== 1) return false;
    const proto = ws.sess.protocol ?? 1;
    const wsBase = this.peerInternalUrl.replace(/^http(s?):\/\//i, 'ws$1://');
    const upstreamUrl = `${wsBase}/internal/ws?p=${encodeURIComponent(String(proto))}&proxied=1`;

    ws.sess.proxied = true;
    ws.sess.proxyQueue = [JSON.stringify({ event: initialEvent, data: initialData ?? {} })];

    const upstream = new WebSocket(upstreamUrl, {
      headers: this.internalHeaders(),
      handshakeTimeout: this.peerTimeoutMs,
    });
    ws.sess.upstream = upstream;
    let opened = false;

    upstream.on('open', () => {
      opened = true;
      if (ws.readyState !== 1 || ws.sess.upstream !== upstream) {
        try { upstream.close(); } catch { /* ignore */ }
        return;
      }
      const queued = ws.sess.proxyQueue || [];
      ws.sess.proxyQueue = [];
      for (const frame of queued) {
        if (upstream.readyState === 1) upstream.send(frame);
      }
      this.log.log(`proxied WS (${initialEvent}, p=${proto}) -> ${this.peerInternalUrl}`);
    });

    upstream.on('message', (data, isBinary) => {
      if (ws.readyState === 1 && ws.sess.upstream === upstream) {
        ws.send(isBinary ? data : data.toString());
      }
    });

    upstream.on('close', (code, reason) => {
      if (ws.sess.upstream !== upstream) return; // proxy torn down on purpose (BUG-44): keep the client
      ws.sess.upstream = undefined;
      if (code === 4401 || code === 1008) this.notePeerStatus(401, 'ws proxy');
      if (ws.readyState === 1) {
        const safeCode = code === 1000 || (code >= 3000 && code <= 4999) ? code : 1000;
        try { ws.close(safeCode, reason?.toString() || ''); } catch { /* ignore */ }
      }
    });

    upstream.on('error', (err) => {
      this.log.warn(`peer WS proxy error (${this.peerInternalUrl}): ${err.message}`);
      if (ws.sess.upstream !== upstream) return;
      if (!opened && ws.readyState === 1) {
        ws.sess.proxied = false;
        ws.sess.proxyQueue = undefined;
        ws.sess.upstream = undefined;
        if (/401/.test(err.message)) this.notePeerStatus(401, 'ws proxy');
        if (onFail) onFail();
        else this.sendToSocket(ws, 'err', fallbackError);
      } else if (ws.readyState === 1) {
        try { ws.close(1011, 'peer_proxy_error'); } catch { /* ignore */ }
      }
    });

    return true;
  }
}
