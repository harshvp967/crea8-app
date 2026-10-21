import { proxyActivities } from '@temporalio/workflow';
import { StalkerDigestActivity } from '@gitroom/orchestrator/activities/stalker.digest.activity';

const { flushStalkerDigests } = proxyActivities<StalkerDigestActivity>({
  startToCloseTimeout: '10 minute',
  retry: {
    maximumAttempts: 2,
    backoffCoefficient: 1,
    initialInterval: '1 minute',
  },
});

export async function stalkerDigestTickWorkflow() {
  await flushStalkerDigests();
}
