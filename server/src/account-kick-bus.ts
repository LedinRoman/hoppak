import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';
import { kickAccount } from './session-kick';

/**
 * Profile and the game sockets run in different processes. A new login NOTIFYs
 * `account_kick`; every game process LISTENs and closes that account's old sockets.
 */
let publishFn: (playerId: string, sessionId: string) => Promise<void> = async () => {};

export function publishAccountKick(playerId: string, sessionId: string) {
  if (!playerId || !sessionId) return;
  publishFn(playerId, sessionId).catch(() => console.error('account_kick notify failed'));
}

@Injectable()
export class AccountKickBus implements OnModuleInit, OnModuleDestroy {
  private stopped = false;
  private client: Client | null = null;
  private timer: NodeJS.Timeout | null = null;
  private delay = 500;
  private connecting = false;

  onModuleInit() {
    publishFn = (playerId, sessionId) => this.notify(playerId, sessionId);
    void this.connect();
  }

  onModuleDestroy() {
    this.stopped = true;
    publishFn = async () => {};
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const c = this.client;
    this.client = null;
    if (c) c.end().catch(() => {});
  }

  private schedule() {
    if (this.stopped || this.timer) return;
    const wait = this.delay;
    this.delay = Math.min(5000, this.delay * 2);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.connect();
    }, wait);
    if (this.timer.unref) this.timer.unref();
  }

  private async connect() {
    if (this.stopped || this.connecting || !process.env.DATABASE_URL) return;
    this.connecting = true;
    const prev = this.client;
    this.client = null;
    if (prev) prev.end().catch(() => {});
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    client.on('notification', (msg: { channel?: string; payload?: string }) => {
      if (!msg || msg.channel !== 'account_kick' || !msg.payload) return;
      try {
        const body = JSON.parse(msg.payload);
        if (body && body.playerId) {
          kickAccount(String(body.playerId), body.sessionId ? String(body.sessionId) : undefined);
        }
      } catch {
        console.error('account_kick payload');
      }
    });
    client.on('error', () => {
      console.error('account_kick listen dropped');
      if (this.client === client) {
        this.client = null;
        this.schedule();
      }
    });
    client.on('end', () => {
      if (this.client !== client) return;
      this.client = null;
      this.schedule();
    });
    try {
      await client.connect();
      await client.query('LISTEN account_kick');
      this.client = client;
      this.delay = 500;
    } catch {
      console.error('account_kick listen failed');
      client.end().catch(() => {});
      this.schedule();
    } finally {
      this.connecting = false;
    }
  }

  private async notify(playerId: string, sessionId: string) {
    if (!process.env.DATABASE_URL) return;
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    try {
      await c.query('SELECT pg_notify($1, $2)', ['account_kick', JSON.stringify({ playerId, sessionId })]);
    } finally {
      await c.end().catch(() => {});
    }
  }
}
