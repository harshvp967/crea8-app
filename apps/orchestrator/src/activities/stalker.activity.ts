import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { StalkerService } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';

@Injectable()
@Activity()
export class StalkerActivity {
  constructor(private _stalkerService: StalkerService) {}

  @ActivityMethod()
  async pollStalker() {
    return this._stalkerService.pollAll();
  }

  @ActivityMethod()
  async scanStalkerProject(input: {
    organizationId: string;
    projectId: string;
    trigger: string;
    runId?: string;
  }) {
    return this._stalkerService.executeProjectScan(input);
  }

  @ActivityMethod()
  async listDueStalkerProjects() {
    return this._stalkerService.listDueProjectScans();
  }
}
