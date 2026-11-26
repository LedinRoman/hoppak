import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WsAdapter } from '@nestjs/platform-ws';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['log', 'warn', 'error'] });
  /* One trusted proxy (Caddy). req.ip and our X-Forwarded-For helper use the rightmost hop. */
  app.set('trust proxy', 1);
  app.useWebSocketAdapter(new WsAdapter(app));
  // One process serves the static client (public/) and the WebSocket (/ws) on the same port,
  // so a single HTTPS tunnel / reverse proxy is enough and the page connects to wss://<same host>/ws.
  const pub = process.env.PUBLIC_DIR || join(__dirname, '..', 'public');
  if (existsSync(pub)) app.useStaticAssets(pub, { index: 'index.html', etag: false, maxAge: 0 });
  app.enableShutdownHooks();
  const port = Number(process.env.PORT || 8787);
  await app.listen(port, '0.0.0.0');
  console.log(`Хоппак server on :${port} (static: ${existsSync(pub) ? pub : 'none'}, ws: /ws)`);
}
bootstrap();
