import { Module } from '@nestjs/common';
import { BlueGreenService } from './bluegreen.service';
import { InternalServer } from './internal.server';

@Module({
  providers: [BlueGreenService, InternalServer],
  exports: [BlueGreenService],
})
export class BlueGreenModule {}
