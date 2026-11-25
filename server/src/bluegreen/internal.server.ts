import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { BlueGreenService } from './bluegreen.service';

@Injectable()
export class InternalServer implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('InternalHTTP');
  private server: Server | null = null;
  readonly port: number | null;

  constructor(private readonly bg: BlueGreenService) {
    const raw = (process.env.INTERNAL_PORT ?? '3001').trim().toLowerCase();
    if (raw === '0' || raw === 'off' || raw === 'none' || raw === 'false') {
      this.port = null;
    } else {
      const n = Number(raw);
      this.port = Number.isInteger(n) && n > 0 && n <= 65535 ? n : 3001;
    }
  }

  async onModuleInit() {
    if (this.port === null) {
      this.log.log('internal HTTP server disabled by INTERNAL_PORT');
      return;
    }
    const server = createServer((req, res) => {
      void this.handle(req, res);
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.port!, '0.0.0.0', () => {
        server.off('error', reject);
        resolve();
      });
    });
    this.server = server;
    this.log.log(`internal HTTP listening on :${this.port} (node=${this.bg.node})`);
  }

  async onModuleDestroy() {
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
      const method = (req.method || 'GET').toUpperCase();
      const url = new URL(req.url || '/', 'http://localhost');
      const path = url.pathname.replace(/\/+$/, '') || '/';

      if (method === 'GET' && path === '/internal/stats') {
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

      const roomMatch = method === 'GET' && path.match(/^\/internal\/rooms\/([^/]+)$/);
      if (roomMatch) {
        const code = decodeURIComponent(roomMatch[1]);
        const room = this.bg.checkRoom(code);
        if (!room) {
          return this.sendJson(res, 404, { exists: false, code: code.trim(), node: this.bg.node });
        }
        return this.sendJson(res, 200, room);
      }

      return this.sendJson(res, 404, { error: 'not_found' });
    } catch (err) {
      this.log.error(err);
      return this.sendJson(res, 500, { error: 'internal_error' });
    }
  }
}
