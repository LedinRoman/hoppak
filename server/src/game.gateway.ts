import { Logger } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway,
} from '@nestjs/websockets';
import type { WebSocket } from 'ws';
import { MAX_MSGS_PER_SEC, PROTOCOL_VERSION } from './protocol';
import { RoomError, RoomsService, Sess, stats } from './rooms.service';

type Sock = WebSocket & { sess: Sess };

@WebSocketGateway({ path: '/ws' })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger('Gateway');
  constructor(private readonly rooms: RoomsService) {}

  handleConnection(ws: Sock) {
    ws.sess = { win: 0, winN: 0 };
    // crude flood guard: count messages per 1s window, drop the excess; kill sockets that keep flooding
    ws.on('message', () => {
      stats.msgsIn++;
      const s = ws.sess, now = Date.now();
      if (now - s.win > 1000) { s.win = now; s.winN = 0; }
      if (++s.winN > MAX_MSGS_PER_SEC * 3) ws.close(4008, 'flood');
    });
    this.rooms.send(ws, 'hello', { v: PROTOCOL_VERSION, s: Date.now() });
  }
  handleDisconnect(ws: Sock) {
    if (ws.sess) this.rooms.disconnected(ws, ws.sess);
  }

  private guard(ws: Sock, fn: () => void) {
    if (ws.sess.winN > MAX_MSGS_PER_SEC) return;
    try { fn(); } catch (e) {
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
    this.rooms.send(ws, 'pong', { c: d && d.c, s: Date.now() });
  }
  @SubscribeMessage('create')
  create(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    this.guard(ws, () => { const hit = this.rooms.create(ws, d?.name, d?.kind); this.attach(ws, hit); this.rooms.pushRoom(hit.room); });
  }
  @SubscribeMessage('join')
  join(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    this.guard(ws, () => { const hit = this.rooms.join(ws, d?.code, d?.name, d?.kind); this.attach(ws, hit); this.rooms.pushRoom(hit.room); });
  }
  @SubscribeMessage('resume')
  resume(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    this.guard(ws, () => {
      const hit = this.rooms.resume(ws, d?.token);
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
    this.guard(ws, () => { const { room, player } = this.inRoom(ws); this.rooms.start(room, player); });
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
