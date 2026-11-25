import { Logger } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway,
} from '@nestjs/websockets';
import type { IncomingMessage } from 'http';
import { BlueGreenService, TrackedSocket } from './bluegreen/bluegreen.service';
import { MAX_MSGS_PER_SEC, MIN_PROTOCOL_VERSION, PROTOCOL_VERSION } from './protocol';
import { RoomError, RoomsService, stats } from './rooms.service';

type Sock = TrackedSocket;

@WebSocketGateway({ path: '/ws' })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger('Gateway');
  constructor(
    private readonly rooms: RoomsService,
    private readonly bg: BlueGreenService,
  ) {
    this.bg.bindRooms(this.rooms);
    this.bg.setInternalWsHandler((ws, req) => this.handleInternalConnection(ws, req));
  }

  private setupSocket(ws: Sock, req?: IncomingMessage, skipHello = false) {
    ws.sess = { win: 0, winN: 0 };
    ws.on('message', (raw, isBinary) => {
      stats.msgsIn++;
      const s = ws.sess, now = Date.now();
      if (now - s.win > 1000) { s.win = now; s.winN = 0; }
      if (++s.winN > MAX_MSGS_PER_SEC * 3) { ws.close(4008, 'flood'); return; }
      if (s.proxied) {
        if (s.upstream && s.upstream.readyState === 1 && !s.proxyQueue?.length) {
          s.upstream.send(isBinary ? raw : raw.toString());
        } else if (s.proxyQueue) {
          s.proxyQueue.push(isBinary ? (raw as Buffer) : raw.toString());
        }
      }
    });
    const nego = this.bg.negotiateProtocol(req?.url);
    if (!nego.ok) {
      ws.sess.unsupported = true;
      this.rooms.send(ws, 'err', {
        code: nego.code, msg: nego.msg, minProtocol: MIN_PROTOCOL_VERSION, protocol: PROTOCOL_VERSION,
      });
      this.rooms.send(ws, 'hello', {
        v: PROTOCOL_VERSION, s: Date.now(), node: this.bg.node,
        minProtocol: MIN_PROTOCOL_VERSION, protocol: PROTOCOL_VERSION, supported: false,
      });
      ws.close(4002, 'unsupported_protocol');
      return false;
    }
    ws.sess.protocol = nego.protocol;
    this.bg.registerClient(ws);
    if (!skipHello) {
      this.rooms.send(ws, 'hello', this.bg.buildHello(nego.protocol));
      this.bg.notifyClientOnConnect(ws);
    }
    return true;
  }

  handleConnection(ws: Sock, req?: IncomingMessage) {
    this.setupSocket(ws, req, false);
  }

  handleInternalConnection(ws: Sock, req: IncomingMessage) {
    let skipHello = false;
    try {
      skipHello = new URL(req.url || '/', 'http://localhost').searchParams.get('proxied') === '1';
    } catch { /* ignore */ }
    if (!this.setupSocket(ws, req, skipHello)) return;
    ws.on('message', (raw) => {
      if (ws.sess.unsupported || ws.sess.proxied) return;
      let m: any;
      try { m = JSON.parse(raw.toString()); } catch { return; }
      if (!m || typeof m.event !== 'string') return;
      void this.dispatchEvent(ws, m.event, m.data);
    });
    ws.on('close', () => this.handleDisconnect(ws));
  }

  handleDisconnect(ws: Sock) {
    this.bg.unregisterClient(ws);
    if (ws.sess?.upstream) {
      try { ws.sess.upstream.close(); } catch { /* ignore */ }
      ws.sess.upstream = undefined;
    }
    if (ws.sess && !ws.sess.proxied) this.rooms.disconnected(ws, ws.sess);
  }

  private dispatchEvent(ws: Sock, event: string, data: any) {
    switch (event) {
      case 'ping': return this.ping(ws, data);
      case 'create': return this.create(ws, data);
      case 'join': return this.join(ws, data);
      case 'resume': return this.resume(ws, data);
      case 'ready': return this.ready(ws, data);
      case 'hero': return this.hero(ws, data);
      case 'map': return this.map(ws, data);
      case 'start': return this.start(ws);
      case 'st': return this.st(ws, data);
      case 'ev': return this.ev(ws, data);
      case 'leave': return this.leave(ws);
    }
  }

  private guard(ws: Sock, fn: () => void) {
    if (ws.sess.unsupported || ws.sess.proxied || ws.sess.winN > MAX_MSGS_PER_SEC) return;
    try { fn(); } catch (e) {
      if (e instanceof RoomError) this.rooms.send(ws, 'err', { code: e.code, msg: e.message });
      else { this.log.error(e); this.rooms.send(ws, 'err', { code: 'INTERNAL', msg: 'Ошибка сервера' }); }
    }
  }
  private async guardAsync(ws: Sock, fn: () => Promise<void>) {
    if (ws.sess.unsupported || ws.sess.proxied || ws.sess.winN > MAX_MSGS_PER_SEC) return;
    try { await fn(); } catch (e) {
      if (ws.readyState !== 1) return;
      if (e instanceof RoomError) this.rooms.send(ws, 'err', { code: e.code, msg: e.message });
      else { this.log.error(e); this.rooms.send(ws, 'err', { code: 'INTERNAL', msg: 'Ошибка сервера' }); }
    }
  }
  private inRoom(ws: Sock) {
    const { room, player } = ws.sess;
    if (!room || !player || !this.rooms.rooms.has(room.code) || player.ws !== ws) throw new RoomError('NO_ROOM', 'Ты не в комнате');
    return { room, player };
  }
  private attach(ws: Sock, hit: { room: any; player: any }) {
    if (ws.sess.room && ws.sess.player && ws.sess.player !== hit.player) this.rooms.leave(ws.sess);
    ws.sess.room = hit.room; ws.sess.player = hit.player;
  }

  @SubscribeMessage('ping')
  ping(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    if (ws.sess?.unsupported || ws.sess?.proxied) return;
    this.rooms.send(ws, 'pong', { c: d && d.c, s: Date.now() });
  }
  @SubscribeMessage('create')
  create(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    return this.guardAsync(ws, async () => {
      if (this.bg.draining) {
        if ((ws.sess.protocol ?? 1) >= 2) {
          const peerNode = await this.bg.resolveActivePeerNode();
          if (ws.readyState !== 1) return;
          if (peerNode) {
            this.rooms.send(ws, 'redirect', { node: peerNode, reason: 'draining' });
            return;
          }
        }
        throw new RoomError('DRAINING', 'Сервер обновляется');
      }
      const hit = this.rooms.create(ws, d?.name, d?.kind, ws.sess.protocol ?? 1);
      this.attach(ws, hit);
      this.rooms.pushRoom(hit.room);
    });
  }
  @SubscribeMessage('join')
  join(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    return this.guardAsync(ws, async () => {
      if (this.bg.shuttingDown) throw new RoomError('DRAINING', 'Сервер перезагружается');
      const code = String(d?.code ?? '').trim();
      if (!this.rooms.rooms.has(code)) {
        const peer = await this.bg.lookupPeerRoom(code);
        if (ws.readyState !== 1) return;
        if (peer) {
          if ((ws.sess.protocol ?? 1) >= 2) {
            this.rooms.send(ws, 'redirect', { node: peer.node, code: peer.code });
            return;
          }
          if (this.bg.proxyToPeer(ws, 'join', { ...d, code }, { code: 'NOT_FOUND', msg: 'Комната не найдена' })) {
            return;
          }
          throw new RoomError('WRONG_NODE', 'Комната на другом узле');
        }
      }
      const hit = this.rooms.join(ws, code, d?.name, d?.kind, ws.sess.protocol ?? 1);
      this.attach(ws, hit);
      this.rooms.pushRoom(hit.room);
    });
  }
  @SubscribeMessage('resume')
  resume(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    return this.guardAsync(ws, async () => {
      const token = String(d?.token ?? '').trim();
      if (!this.rooms.findToken(token)) {
        const peer = await this.bg.lookupPeerToken(token);
        if (ws.readyState !== 1) return;
        if (peer && this.bg.proxyToPeer(ws, 'resume', { token }, { code: 'NO_SESSION', msg: 'Сессия истекла' })) {
          return;
        }
      }
      const hit = this.rooms.resume(ws, token);
      this.attach(ws, hit);
      this.rooms.pushRoom(hit.room);
      if (hit.room.phase === 'play') this.rooms.send(ws, 'start', { ...this.rooms.startView(hit.room), resumed: true });
    });
  }
  @SubscribeMessage('ready')
  ready(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    this.guard(ws, () => { const { room, player } = this.inRoom(ws); this.rooms.setReady(room, player, d?.ready); this.rooms.pushRoom(room); });
  }
  @SubscribeMessage('hero')
  hero(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    this.guard(ws, () => { const { room, player } = this.inRoom(ws); this.rooms.setHero(room, player, d?.kind); this.rooms.pushRoom(room); });
  }
  @SubscribeMessage('map')
  map(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    this.guard(ws, () => { const { room, player } = this.inRoom(ws); this.rooms.setMap(room, player, d?.map); this.rooms.pushRoom(room); });
  }
  @SubscribeMessage('start')
  start(@ConnectedSocket() ws: Sock) {
    return this.guardAsync(ws, async () => {
      const { room, player } = this.inRoom(ws);
      if (this.bg.draining || this.bg.shuttingDown) {
        if (player.pid !== room.host) throw new RoomError('NOT_HOST', 'Только хост');
        if ((ws.sess.protocol ?? 1) >= 2) {
          if (this.bg.announcedVersion) this.rooms.send(ws, 'update', { version: this.bg.announcedVersion });
          const peerNode = await this.bg.resolveActivePeerNode();
          if (ws.readyState !== 1) return;
          if (peerNode) { this.rooms.send(ws, 'redirect', { node: peerNode, reason: 'draining' }); return; }
        }
        throw new RoomError('DRAINING', 'Сервер обновляется');
      }
      this.rooms.start(room, player);
    });
  }
  @SubscribeMessage('st')
  st(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    this.guard(ws, () => { const { room, player } = this.inRoom(ws); this.rooms.state(room, player, d); });
  }
  @SubscribeMessage('ev')
  ev(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    this.guard(ws, () => { const { room, player } = this.inRoom(ws); this.rooms.event(room, player, d); });
  }
  @SubscribeMessage('leave')
  leave(@ConnectedSocket() ws: Sock) {
    this.guard(ws, () => this.rooms.leave(ws.sess));
  }
}
