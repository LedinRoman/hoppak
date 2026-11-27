import { Controller, Get, Header } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

@Controller('api/admin')
export class AdminPageController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  page() {
    return readFile(join(__dirname, '../../admin/telemetry.html'), 'utf8');
  }
}
