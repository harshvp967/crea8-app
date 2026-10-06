import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client, ScheduleOverlapPolicy } from '@temporalio/client';
import { TemporalService } from 'nestjs-temporal-core';
import { stalkerPollMinutes } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';

const SCHEDULE_ID = 'stalker-poll';
const LEGACY_WORKFLOW_ID = 'stalker-poll-workflow';

const alreadyThere = (err: unknown) => {
  const name =
    err && typeof err === 'object' && 'name' in err
      ? String((err as { name: string }).name)
      : '';
  const message = err instanceof Error ? err.message : '';
  return /already|Already/i.test(`${name} ${message}`);
};

@Injectable()
export class StalkerScheduleRegister implements OnModuleInit {
  constructor(private _temporalService: TemporalService) {}

  async onModuleInit() {
    if (process.env.STALKER_ENABLED !== 'true') {
      return;
    }
    const client = this._temporalService.client?.getRawClient?.();
    if (!client?.schedule || !client.workflow) {
      console.error('Stalker schedule skipped, Temporal client is missing');
      return;
    }
    await this.retireLegacyLoop(client);
    await this.ensureSchedule(client);
  }

  private async retireLegacyLoop(client: Client) {
    try {
      const handle = client.workflow.getHandle(LEGACY_WORKFLOW_ID);
      const described = await handle.describe();
      if (described.status?.name === 'RUNNING') {
        await handle.terminate('Replaced by the stalker-poll schedule');
        console.log('Stalker retired stalker-poll-workflow');
      }
    } catch (err) {
      if (!alreadyThere(err) && !/not found/i.test(err instanceof Error ? err.message : '')) {
        console.error('Stalker could not retire the old poll workflow', err);
      }
    }
  }

  private async ensureSchedule(client: Client) {
    const every = stalkerPollMinutes() * 60 * 1000;
    const action = {
      type: 'startWorkflow' as const,
      workflowType: 'stalkerPollDueWorkflow',
      taskQueue: 'main',
    };
    try {
      await client.schedule.create({
        scheduleId: SCHEDULE_ID,
        spec: { intervals: [{ every }] },
        policies: { overlap: ScheduleOverlapPolicy.SKIP },
        action,
      });
      console.log(`Stalker schedule ${SCHEDULE_ID} every ${every}ms`);
    } catch (err) {
      if (!alreadyThere(err)) {
        console.error('Stalker schedule create failed', err);
        return;
      }
      try {
        await client.schedule.getHandle(SCHEDULE_ID).update((previous) => ({
          spec: { ...previous.spec, intervals: [{ every }] },
          policies: {
            ...previous.policies,
            overlap: ScheduleOverlapPolicy.SKIP,
          },
          action,
          state: {
            paused: previous.state.paused,
            note: previous.state.note,
            remainingActions: previous.state.remainingActions,
          },
        }));
        console.log(`Stalker schedule ${SCHEDULE_ID} updated to every ${every}ms`);
      } catch (updateErr) {
        console.error('Stalker schedule update failed', updateErr);
      }
    }
  }
}
