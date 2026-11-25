import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { WebSocket } from 'ws';
import { MIN_PROTOCOL_VERSION, PROTOCOL_VERSION } from '../protocol';
import { RoomsService, Sess } from '../rooms.service';

export type TrackedSocket = WebSocket & { sess: Sess & { protocol?: number; unsupported?: boolean } };

export interface PeerStats {
  rooms: number;
  players: number;
  draining: boolean;
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

@Injectable()
export class BlueGreenService {
  private readonly log = new Logger('BlueGreen');
  readonly node: string;
  readonly version: string;
  readonly peerInternalUrl: string;
  readonly peerNodeFallback: string;
  readonly peerTimeoutMs: number;

  draining = false;
  announcedVersion: string | null = null;

  private readonly clients = new Set<TrackedSocket>();
  private roomsService: RoomsService | null = null;

  constructor() {
    this.node = (process.env.NODE_NAME || 'local').trim() || 'local';
    this.version = (process.env.APP_VERSION || '').trim() || readPackageVersion();
    this.peerInternalUrl = (process.env.PEER_INTERNAL_URL || '').trim().replace(/\/+$/, '');
    this.peerNodeFallback = (
      process.env.PEER_NODE_NAME ||
      (this.node === 'blue' ? 'green' : this.node === 'green' ? 'blue' : '')
    ).trim();
    const timeout = Number(process.env.PEER_TIMEOUT_MS || 800);
    this.peerTimeoutMs = Number.isFinite(timeout) && timeout > 0 ? timeout : 800;
  }

  bindRooms(rooms: RoomsService) {
    this.roomsService = rooms;
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
      // Legacy clients (v0.56, v0.57) connect to /ws without ?p=...
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
      // v0.57 strictly requires d.v === 1; unknown fields are ignored by v0.56 & v0.57.
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
      if (proto >= 2 && !ws.sess?.unsupported && ws.readyState === 1) {
        this.sendToSocket(ws, 'update', { version: ver });
        notified++;
      }
    }
    this.log.log(`update(${ver}) announced to ${notified} v2+ client(s)`);
    return { version: ver, notified };
  }

  async drain(version?: string) {
    this.draining = true;
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
    this.log.log(`drain disabled on node=${this.node}`);
    return { ok: true, ...this.getStats() };
  }

  async lookupPeerRoom(code: string): Promise<PeerRoomCheck | null> {
    if (!this.peerInternalUrl) return null;
    const clean = String(code ?? '').trim();
    if (!/^\d{4}$/.test(clean)) return null;
    try {
      const res = await fetch(`${this.peerInternalUrl}/internal/rooms/${encodeURIComponent(clean)}`, {
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

  async lookupPeerStats(): Promise<PeerStats | null> {
    if (!this.peerInternalUrl) return null;
    try {
      const res = await fetch(`${this.peerInternalUrl}/internal/stats`, {
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
      return peer.draining ? null : peer.node;
    }
    return this.peerNodeFallback || null;
  }
}
