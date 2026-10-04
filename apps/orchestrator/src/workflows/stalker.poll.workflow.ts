import { proxyActivities, sleep } from '@temporalio/workflow';
import { StalkerActivity } from '@gitroom/orchestrator/activities/stalker.activity';

const { pollStalker } = proxyActivities<StalkerActivity>({
  startToCloseTimeout: '15 minute',
  retry: {
    maximumAttempts: 2,
    backoffCoefficient: 1,
    initialInterval: '1 minute',
  },
});

export async function stalkerPollWorkflow() {
  while (true) {
    await pollStalker();
    await sleep('6 hours');
  }
}
