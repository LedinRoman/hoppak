import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { WebSocketServer } from 'ws';
import { RoomError } from '../rooms.service';
import { BlueGreenService, TrackedSocket } from './bluegreen.service';

@Injectable()
export class InternalServer implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('InternalHTTP');
  private server: Server | null = null;
  private wss: WebSocketServer | null = null;
  readonly port: number | null;
  readonly host: string;
  readonly token: string;
  private readonly isLoopback: boolean;
  private lastRejectLogAt = 0;
  private rejectedSinceLog = 0;

  constructor(private readonly bg: BlueGreenService) {
    const raw = (process.env.INTERNAL_PORT ?? '').trim().toLowerCase();
    if (!raw || raw === '0' || raw === 'off' || raw === 'none' || raw === 'false') {
      this.port = null;
    } else {
      const n = Number(raw);
      this.port = Number.isInteger(n) && n > 0 && n <= 65535 ? n : null;
    }
    this.host = (process.env.INTERNAL_HOST || '127.0.0.1').trim() || '127.0.0.1';
    this.token = bg.internalToken;
    this.isLoopback = this.host === '127.0.0.1' || this.host === '::1' || this.host === 'localhost';
  }

  /** BUG-48: a token mismatch must be visible in the log (rate-limited). */
  private logReject(req: IncomingMessage, code: string) {
    this.rejectedSinceLog++;
    const now = Date.now();
    if (now - this.lastRejectLogAt < 10_000) return;
    this.log.error(
      `rejected ${req.method || 'GET'} ${(req.url || '').split('?')[0]} from ${req.socket?.remoteAddress || '?'}: ${code} ` +
      `(${this.rejectedSinceLog} rejected in the last window). INTERNAL_TOKEN must be identical on both slots and in deploy.sh`,
    );
    this.lastRejectLogAt = now;
    this.rejectedSinceLog = 0;
  }

  private checkAuth(req: IncomingMessage): { ok: true } | { ok: false; code: string } {
    if (!this.token) {
      if (this.isLoopback) return { ok: true };
      return { ok: false, code: 'internal_token_required' };
    }
    const hdr = req.headers['x-internal-token'];
    let supplied = Array.isArray(hdr) ? hdr[0] : hdr || '';
    if (!supplied && typeof req.headers.authorization === 'string') {
      const m = req.headers.authorization.match(/^Bearer\s+(.+)$/i);
      if (m) supplied = m[1];
    }
    const a = Buffer.from(supplied.trim());
    const b = Buffer.from(this.token);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, code: 'unauthorized' };
    }
    return { ok: true };
  }

  async onModuleInit() {
    if (this.port === null) {
      this.log.log('internal HTTP/WS server disabled (INTERNAL_PORT unset)');
      return;
    }
    if (!this.token) {
      if (this.isLoopback) {
        this.log.warn('INTERNAL_TOKEN not set; allowing loopback-only access on ' + this.host);
      } else {
        this.log.error(`INTERNAL_TOKEN not set with non-loopback INTERNAL_HOST=${this.host}; all /internal/* requests will return 401`);
      }
    }

    const wss = new WebSocketServer({ noServer: true });
    this.wss = wss;

    const server = createServer((req, res) => {
      void this.handle(req, res);
    });
    server.on('upgrade', (req, socket, head) => {
      try {
        const auth = this.checkAuth(req);
        if (!auth.ok) {
          this.logReject(req, auth.code);
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname.replace(/\/+$/, '') !== '/internal/ws') {
          socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          this.bg.handleInternalWs(ws as TrackedSocket, req);
        });
      } catch {
        socket.destroy();
      }
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.port!, this.host, () => {
        server.off('error', reject);
        resolve();
      });
    });
    this.server = server;
    this.log.log(`internal HTTP/WS listening on ${this.host}:${this.port} (node=${this.bg.node}, auth=${this.token ? 'token' : 'loopback'})`);
  }

  async onModuleDestroy() {
    if (this.wss) {
      for (const client of this.wss.clients) {
        try { client.close(1001, 'shutdown'); } catch { /* ignore */ }
      }
      this.wss.close();
      this.wss = null;
    }
    if (!this.server) return;
    const srv = this.server;
    this.server = null;
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  }

  private sendJson(res: ServerResponse, status: number, body: unknown) {
    const payload = JSON.stringify(body);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(payload);
  }

  private async readBody(req: IncomingMessage): Promise<Record<string, any>> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > 16 * 1024) throw new Error('body_too_large');
      chunks.push(buf);
    }
    if (!chunks.length) return {};
    const text = Buffer.concat(chunks).toString('utf8').trim();
    if (!text) return {};
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private async handle(req: IncomingMessage, res: ServerResponse) {
    try {
      const auth = this.checkAuth(req);
      if (!auth.ok) {
        this.logReject(req, auth.code);
        return this.sendJson(res, 401, { error: auth.code });
      }
      const method = (req.method || 'GET').toUpperCase();
      const url = new URL(req.url || '/', 'http://localhost');
      const path = url.pathname.replace(/\/+$/, '') || '/';

      if (method === 'GET' && path === '/internal/stats') {
        await this.bg.refreshPeerAuth();
        return this.sendJson(res, 200, this.bg.getStats());
      }

      if (method === 'POST' && path === '/internal/drain') {
        const body = await this.readBody(req);
        const ver = typeof body.version === 'string' ? body.version : url.searchParams.get('version') || undefined;
        return this.sendJson(res, 200, await this.bg.drain(ver));
      }

      if (method === 'POST' && path === '/internal/undrain') {
        return this.sendJson(res, 200, this.bg.undrain());
      }

      if (method === 'POST' && path === '/internal/announce-update') {
        const body = await this.readBody(req);
        const ver = typeof body.version === 'string' ? body.version : url.searchParams.get('version') || undefined;
        const result = this.bg.announceUpdate(ver);
        return this.sendJson(res, 200, { ok: true, node: this.bg.node, ...result });
      }

      if (method === 'POST' && path === '/internal/rooms/import') {
        const body = await this.readBody(req);
        try {
          return this.sendJson(res, 200, this.bg.importRoom(body));
        } catch (e) {
          if (e instanceof RoomError) return this.sendJson(res, e.code === 'DRAINING' ? 409 : 400, { ok: false, error: e.code, msg: e.message });
          throw e;
        }
      }

      const roomMatch = method === 'GET' && path.match(/^\/internal\/rooms\/([^/]+)$/);
      if (roomMatch) {
        const code = decodeURIComponent(roomMatch[1]);
        const room = this.bg.checkRoom(code);
        if (!room) {
          return this.sendJson(res, 404, { exists: false, code: code.trim(), node: this.bg.node });
        }
        return this.sendJson(res, 200, room);
      }

      const tokMatch = method === 'GET' && path.match(/^\/internal\/tokens\/([^/]+)$/);
      if (tokMatch) {
        const token = decodeURIComponent(tokMatch[1]);
        const hit = this.bg.checkToken(token);
        if (!hit) {
          return this.sendJson(res, 404, { exists: false, node: this.bg.node });
        }
        return this.sendJson(res, 200, hit);
      }

      return this.sendJson(res, 404, { error: 'not_found' });
    } catch (err) {
      this.log.error(err);
      return this.sendJson(res, 500, { error: 'internal_error' });
    }
  }
}
