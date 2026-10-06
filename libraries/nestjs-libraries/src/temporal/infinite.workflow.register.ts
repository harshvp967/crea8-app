import { Global, Injectable, Module, OnModuleInit } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class InfiniteWorkflowRegister implements OnModuleInit {
  constructor(private _temporalService: TemporalService) {}

  async onModuleInit(): Promise<void> {
    if (!!process.env.RUN_CRON) {
      try {
        await this._temporalService.client
          ?.getRawClient()
          ?.workflow?.start('missingPostWorkflow', {
            workflowId: 'missing-post-workflow',
            taskQueue: 'main',
          });
      } catch (err) {
        const message = err instanceof Error ? `${err.name} ${err.message}` : '';
        if (!/AlreadyStarted|already started/i.test(message)) {
          console.error('Could not start missing-post workflow', err);
        }
      }
      // Stalker scans are started by the orchestrator schedule `stalker-poll`.
      // The old stalker-poll-workflow loop is left untouched so a running
      // execution can finish, and the orchestrator terminates it on boot.
    }
  }
}

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [InfiniteWorkflowRegister],
  get exports() {
    return this.providers;
  },
})
export class InfiniteWorkflowRegisterModule {}
