import { Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway,
} from '@nestjs/websockets';
import type { WebSocket } from 'ws';
import { MAX_MSGS_PER_SEC, PROTOCOL_VERSION } from './protocol';
import { RoomError, RoomsService, Sess, stats } from './rooms.service';
import { ProfileService } from './profile/profile.service';
import { OnlineService } from './online.service';

type Sock = WebSocket & { sess: Sess };

function parsePositiveMs(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

@WebSocketGateway({ path: '/ws' })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly log = new Logger('Gateway');
  private readonly clients = new Set<Sock>();
  private readonly heartbeats = new WeakMap<WebSocket, { lastPongAt: number }>();
  private readonly wsPingMs: number;
  private readonly wsPongTimeoutMs: number;
  private wsPingTimer: NodeJS.Timeout | null = null;
  private presenceTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly rooms: RoomsService,
    @Optional() private readonly profiles?: ProfileService,
    @Optional() private readonly online?: OnlineService,
  ) {
    this.wsPingMs = parsePositiveMs(process.env.WS_PING_MS, 25_000);
    this.wsPongTimeoutMs = parsePositiveMs(process.env.WS_PONG_TIMEOUT_MS, 60_000);
    this.wsPingTimer = setInterval(() => this.sweepHeartbeats(), this.wsPingMs);
    this.wsPingTimer.unref();
    this.presenceTimer = setInterval(() => this.sweepPresence(), 30_000);
    this.presenceTimer.unref();
  }

  onModuleDestroy() {
    if (this.wsPingTimer) { clearInterval(this.wsPingTimer); this.wsPingTimer = null; }
    if (this.presenceTimer) { clearInterval(this.presenceTimer); this.presenceTimer = null; }
  }

  /** Room name = what the ИМЯ button shows (typed name, else own nickname), cleaned; identity name only as fallback. */
  private roomName(idn: { name: string } | null, d: any): string {
    /* The client sends the name it shows on the ИМЯ button: the typed one, else the player's own nickname
       (Telegram first name / guest HOP-xxxx). Use it so lobby, game and score match the menu. */
    const shown = d ? String(d.name ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 10) : '';
    if (shown) return shown;
    return idn ? idn.name : d?.name;
  }
  private async identity(token: unknown) {
    if (!this.profiles || typeof token !== 'string' || !token) return null;
    try { return await this.profiles.identityForToken(token); } catch { return null; }
  }
  /** The login behind this socket's token was replaced by another device: no seat, tell the client, close 4001. */
  private denyReplaced(ws: Sock) {
    this.log.log('ws: a replaced login tried to enter a room, refused (4001)');
    this.rooms.send(ws, 'replaced', {});
    try { ws.close(4001, 'replaced'); } catch { /* ignore */ }
  }
  private seen(ws: Sock, room: string, d: any, screen: string) {
    const id = ws.sess && ws.sess.accountId;
    if (!id || !this.online) return;
    const asked = d && (d.screen === 'game' || d.screen === 'spectator' || d.screen === 'lobby') ? d.screen : screen;
    const ver = String((d && d.v) || '').slice(0, 16);
    const plat = String((d && d.p) || '').slice(0, 16);
    if (ver) ws.sess.clientVersion = ver;
    if (plat) ws.sess.platform = plat;
    this.online.touch({
      playerId: id,
      room,
      screen: asked,
      clientVersion: ws.sess.clientVersion || '',
      platform: ws.sess.platform || '',
    });
  }
  /** Any socket traffic from a signed-in account counts as "seen"; the service writes at most once per 20 s. */
  private pulse(ws: Sock) {
    const s = ws.sess;
    const id = s && s.accountId;
    if (!id || !this.online) return;
    const screen = s.room && s.player ? (s.room.phase === 'play' ? (s.player.dead ? 'spectator' : 'game') : 'lobby') : 'menu';
    this.online.touch({ playerId: id, room: s.room ? s.room.code : '', screen, clientVersion: s.clientVersion || '', platform: s.platform || '' });
  }
  private sweepPresence() {
    for (const ws of this.clients) {
      const s = ws.sess;
      if (!s || !s.accountId || !s.room || !s.player) continue;
      const screen = s.room.phase === 'play' ? (s.player.dead ? 'spectator' : 'game') : 'lobby';
      this.seen(ws, s.room.code, {}, screen);
    }
  }

  private attachHeartbeat(ws: Sock) {
    if (this.heartbeats.has(ws)) return;
    const state = { lastPongAt: Date.now() };
    this.heartbeats.set(ws, state);
    ws.on('pong', () => { state.lastPongAt = Date.now(); });
  }

  private sweepHeartbeats() {
    const now = Date.now();
    for (const ws of [...this.clients]) {
      if (ws.readyState === 0) {
        const hb = this.heartbeats.get(ws);
        if (hb) hb.lastPongAt = now;
        continue;
      }
      if (ws.readyState !== 1) {
        this.clients.delete(ws);
        continue;
      }
      const hb = this.heartbeats.get(ws);
      if (hb && now - hb.lastPongAt > this.wsPongTimeoutMs) {
        this.log.warn(`terminating dead WS (no pong for ${now - hb.lastPongAt}ms > ${this.wsPongTimeoutMs}ms)`);
        this.clients.delete(ws);
        const id = ws.sess && ws.sess.accountId;
        if (id && this.online) this.online.leave(id);
        try { ws.terminate(); } catch { /* ignore */ }
        continue;
      }
      try { ws.ping(); } catch { /* ignore */ }
    }
  }

  handleConnection(ws: Sock) {
    ws.sess = { win: 0, winN: 0 };
    this.clients.add(ws);
    this.attachHeartbeat(ws);
    // crude flood guard: count messages per 1s window, drop the excess; kill sockets that keep flooding
    ws.on('message', () => {
      stats.msgsIn++;
      this.pulse(ws);
      const s = ws.sess, now = Date.now();
      if (now - s.win > 1000) { s.win = now; s.winN = 0; }
      if (++s.winN > MAX_MSGS_PER_SEC * 3) ws.close(4008, 'flood');
    });
    this.rooms.send(ws, 'hello', { v: PROTOCOL_VERSION, s: Date.now() });
  }
  handleDisconnect(ws: Sock) {
    this.clients.delete(ws);
    const id = ws.sess && ws.sess.accountId;
    if (ws.sess) this.rooms.disconnected(ws, ws.sess);
    if (id && this.online) this.online.leave(id);
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
  async create(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    const idn0 = await this.identity(d?.pt);
    if (idn0 && 'replaced' in idn0) { this.denyReplaced(ws); return; }
    const idn = idn0;
    this.guard(ws, () => {
      if (idn) {
        ws.sess.accountId = idn.id; ws.sess.sessionId = idn.sessionId;
        /* One account = one player: seats of this account under any other (older) login are dropped first. */
        this.rooms.kickAccount(idn.id, idn.sessionId);
      }
      const hit = this.rooms.create(ws, this.roomName(idn, d), d?.kind, d?.g, idn?.id);
      if (idn && hit.player) hit.player.sessionId = idn.sessionId;
      this.attach(ws, hit);
      this.rooms.pushRoom(hit.room);
      this.seen(ws, hit.room.code, d, 'lobby');
    });
  }
  @SubscribeMessage('join')
  async join(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    const idn0 = await this.identity(d?.pt);
    if (idn0 && 'replaced' in idn0) { this.denyReplaced(ws); return; }
    const idn = idn0;
    this.guard(ws, () => {
      if (idn) {
        ws.sess.accountId = idn.id; ws.sess.sessionId = idn.sessionId;
        /* One account = one player: seats of this account under any other (older) login are dropped first. */
        this.rooms.kickAccount(idn.id, idn.sessionId);
      }
      const hit = this.rooms.join(ws, d?.code, this.roomName(idn, d), d?.kind, d?.g, idn?.id);
      if (idn && hit.player) hit.player.sessionId = idn.sessionId;
      this.attach(ws, hit);
      this.rooms.pushRoom(hit.room);
      this.seen(ws, hit.room.code, d, 'lobby');
    });
  }
  @SubscribeMessage('resume')
  resume(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    this.guard(ws, () => {
      const hit = this.rooms.resume(ws, d?.token);
      this.attach(ws, hit);
      if (hit.player && hit.player.accountId) {
        ws.sess.accountId = hit.player.accountId;
        ws.sess.sessionId = hit.player.sessionId;
      }
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
  @SubscribeMessage('bot')
  bot(@ConnectedSocket() ws: Sock) {
    this.guard(ws, () => { const { room, player } = this.inRoom(ws); this.rooms.addBot(room, player); this.rooms.pushRoom(room); });
  }
  @SubscribeMessage('kick')
  kick(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    this.guard(ws, () => { const { room, player } = this.inRoom(ws); this.rooms.kick(room, player, d?.pid); });
  }
  @SubscribeMessage('sb')
  sb(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    this.guard(ws, () => { const { room, player } = this.inRoom(ws); this.rooms.botsState(room, player, d); });
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
    this.guard(ws, () => {
      const id = ws.sess.accountId;
      this.rooms.leave(ws.sess);
      if (id && this.online) this.online.leave(id);
    });
  }
  @SubscribeMessage('presence')
  presence(@ConnectedSocket() ws: Sock, @MessageBody() d: any) {
    this.guard(ws, () => {
      const room = ws.sess.room;
      if (!room || !ws.sess.accountId) return;
      this.seen(ws, room.code, d, room.phase === 'play' ? 'game' : 'lobby');
    });
  }
}
