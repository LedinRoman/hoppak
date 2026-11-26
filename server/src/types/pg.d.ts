declare module 'pg' {
  import { EventEmitter } from 'events';
  export class Client extends EventEmitter {
    constructor(config?: unknown);
    connect(): Promise<void>;
    query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
    end(): Promise<void>;
  }
}
