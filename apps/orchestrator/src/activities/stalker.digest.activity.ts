import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { StalkerService } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';

@Injectable()
@Activity()
export class StalkerDigestActivity {
  constructor(private _stalkerService: StalkerService) {}

  @ActivityMethod()
  async flushStalkerDigests() {
    return this._stalkerService.flushDueDigests();
  }
}
