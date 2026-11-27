import { Controller, Get, Header } from '@nestjs/common';
import { DEFAULT_VISUAL_CONTRAST } from '../db/game-setting.entity';

@Controller('api')
export class VisualConfigController {
  /* Code defaults only. A leftover visual_contrast row on staging must not
     override them. Codex's admin (another repo) can wire row reads later. */
  @Get('config/visual')
  @Header('Cache-Control', 'public, max-age=60')
  getVisual() {
    return { ...DEFAULT_VISUAL_CONTRAST };
  }
}
