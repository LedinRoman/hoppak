import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WsAdapter } from '@nestjs/platform-ws';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { BlueGreenService } from './bluegreen/bluegreen.service';
import { startupProblems } from './bluegreen/startup-check';

async function bootstrap() {
  const problems = startupProblems();
  if (problems.length) {
    for (const p of problems) console.error(`[Startup] FATAL: ${p}`);
    process.exit(1);
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['log', 'warn', 'error'] });
  app.useWebSocketAdapter(new WsAdapter(app));
  // One process serves the static client (public/) and the WebSocket (/ws) on the same port,
  // so a single HTTPS tunnel / reverse proxy is enough and the page connects to wss://<same host>/ws.
  const pub = process.env.PUBLIC_DIR || join(__dirname, '..', 'public');
  if (existsSync(pub)) app.useStaticAssets(pub, { index: 'index.html', etag: false, maxAge: 0 });
  const bg = app.get(BlueGreenService);
  // process.on (not once): a repeated SIGTERM/SIGINT must not fall back to Node's default "exit now" (BUG-45).
  // gracefulShutdown() ignores repeats; the hard stop is only its own GRACEFUL_SHUTDOWN_MS timeout.
  process.on('SIGTERM', () => void bg.gracefulShutdown(app, 'SIGTERM'));
  process.on('SIGINT', () => void bg.gracefulShutdown(app, 'SIGINT'));
  const port = Number(process.env.PORT || 8787);
  await app.listen(port, '0.0.0.0');
  console.log(`Хоппак server on :${port} (static: ${existsSync(pub) ? pub : 'none'}, ws: /ws)`);
}
bootstrap();
