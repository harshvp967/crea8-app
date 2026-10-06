import {
  ParentClosePolicy,
  proxyActivities,
  sleep,
  startChild,
} from '@temporalio/workflow';
import { StalkerActivity } from '@gitroom/orchestrator/activities/stalker.activity';

const { scanStalkerProject, listDueStalkerProjects } =
  proxyActivities<StalkerActivity>({
    startToCloseTimeout: '15 minute',
    retry: {
      maximumAttempts: 2,
      backoffCoefficient: 1,
      initialInterval: '1 minute',
    },
  });

export async function stalkerScanProjectWorkflow(input: {
  organizationId: string;
  projectId: string;
  trigger: string;
  runId?: string;
}) {
  await scanStalkerProject(input);
}

// Hourly schedule entry. Starts one workflow per due project and does not
// die when a single project fails. The child keeps running if this parent ends.
export async function stalkerPollDueWorkflow() {
  const due = await listDueStalkerProjects();
  for (const project of due) {
    try {
      await startChild(stalkerScanProjectWorkflow, {
        workflowId: `stalker-scan-${project.projectId}`,
        args: [project],
        parentClosePolicy: ParentClosePolicy.ABANDON,
      });
    } catch (err) {
      const name =
        err && typeof err === 'object' && 'name' in err
          ? String((err as { name: string }).name)
          : '';
      const message = err instanceof Error ? err.message : '';
      if (!/AlreadyStarted|already started/i.test(`${name} ${message}`)) {
        console.error('Stalker could not start project scan', project.projectId, err);
      }
    }
    await sleep('3 seconds');
  }
}
