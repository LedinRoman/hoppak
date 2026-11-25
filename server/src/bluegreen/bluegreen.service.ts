import { INestApplication, Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import type { IncomingMessage } from 'http';
import { join } from 'path';
import WebSocket from 'ws';
import { MIN_PROTOCOL_VERSION, PROTOCOL_VERSION } from '../protocol';
import { Room, RoomsService, Sess } from '../rooms.service';

export type TrackedSocket = WebSocket & {
  sess: Sess & {
    protocol?: number;
    unsupported?: boolean;
    proxied?: boolean;
    upstream?: WebSocket;
    proxyQueue?: (string | Buffer)[];
  };
};

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

  draining = false;
  shuttingDown = false;
  announcedVersion: string | null = null;

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
      void this.closeDrainedRoom(r);
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

  private async closeDrainedRoom(r: Room) {
    if (!this.roomsService || !this.roomsService.rooms.has(r.code)) return;
    if (r.phase === 'play') return;
    r.drainCloseAt = undefined;
    const peerNode = await this.resolveActivePeerNode();
    const live = this.roomsService.rooms.get(r.code);
    if (!live || live.phase === 'play') return;

    for (const p of [...r.players]) {
      const ws = p.ws as TrackedSocket | null;
      if (!ws || ws.readyState !== 1) continue;
      const proto = ws.sess?.protocol ?? 1;
      if (proto >= 2) {
        if (this.announcedVersion) {
          this.sendToSocket(ws, 'update', { version: this.announcedVersion });
        }
        if (peerNode) {
          this.sendToSocket(ws, 'redirect', { node: peerNode, reason: 'draining' });
        } else {
          this.sendToSocket(ws, 'err', { code: 'DRAINING', msg: 'Сервер обновляется' });
        }
      } else {
        this.sendToSocket(ws, 'err', { code: 'DRAINING', msg: 'Сервер обновляется' });
        this.sendToSocket(ws, 'err', { code: 'NO_SESSION', msg: 'Сервер обновляется' });
      }
    }
    this.roomsService.destroyRoom(r);
  }

  async gracefulShutdown(app: INestApplication, signal: string) {
    if (this.shuttingDown) return;
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
        for (const r of [...this.roomsService.rooms.values()]) {
          if (r.phase !== 'play') await this.closeDrainedRoom(r);
        }
        const deadline = Date.now() + this.gracefulShutdownMs;
        while (Date.now() < deadline) {
          const activePlay = [...this.roomsService.rooms.values()].some((r) => r.phase === 'play');
          if (!activePlay) break;
          await new Promise((res) => setTimeout(res, 150));
        }
        const remaining = [...this.roomsService.rooms.values()].filter((r) => r.phase === 'play').length;
        if (remaining > 0) {
          this.log.warn(`graceful timeout reached with ${remaining} active room(s); sending results and closing`);
          this.roomsService.forceFinishAll('SERVER_SHUTDOWN', 'Сервер перезагружается');
        } else {
          for (const r of [...this.roomsService.rooms.values()]) {
            await this.closeDrainedRoom(r);
          }
        }
        await new Promise((res) => setTimeout(res, 150));
      }
      for (const ws of this.clients) {
        if (ws.readyState === 1) {
          try { ws.close(1001, 'server_shutdown'); } catch { /* ignore */ }
        }
      }
      await app.close();
    } catch (err) {
      this.log.error(`error during graceful shutdown: ${(err as Error).message}`);
    } finally {
      clearTimeout(failsafe);
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
      if (!res.ok) return null;
      const body = (await res.json()) as PeerRoomCheck;
      if (body && body.exists && body.node) return body;
      return null;
    } catch (err) {
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
      if (!res.ok) return null;
      const body = (await res.json()) as PeerTokenCheck;
      if (body && body.exists && body.node) return body;
      return null;
    } catch (err) {
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
      if (!res.ok) return null;
      return (await res.json()) as PeerStats;
    } catch (err) {
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

  proxyToPeer(
    ws: TrackedSocket,
    initialEvent: string,
    initialData: unknown,
    fallbackError: { code: string; msg: string },
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
      if (ws.readyState !== 1) {
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
      if (ws.readyState === 1) {
        ws.send(isBinary ? data : data.toString());
      }
    });

    upstream.on('close', (code, reason) => {
      ws.sess.upstream = undefined;
      if (ws.readyState === 1) {
        const safeCode = code === 1000 || (code >= 3000 && code <= 4999) ? code : 1000;
        try { ws.close(safeCode, reason?.toString() || ''); } catch { /* ignore */ }
      }
    });

    upstream.on('error', (err) => {
      this.log.warn(`peer WS proxy error (${this.peerInternalUrl}): ${err.message}`);
      if (!opened && ws.readyState === 1) {
        ws.sess.proxied = false;
        ws.sess.proxyQueue = undefined;
        ws.sess.upstream = undefined;
        this.sendToSocket(ws, 'err', fallbackError);
      } else if (ws.readyState === 1) {
        try { ws.close(1011, 'peer_proxy_error'); } catch { /* ignore */ }
      }
    });

    return true;
  }
}
