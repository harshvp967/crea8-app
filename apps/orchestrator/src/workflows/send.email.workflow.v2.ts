import {
  proxyActivities,
  setHandler,
  condition,
  sleep,
  continueAsNew,
} from '@temporalio/workflow';
import { EmailActivity } from '@gitroom/orchestrator/activities/email.activity';
import {
  SendDocumentEmail,
  sendDocumentEmailSignal,
} from '@gitroom/orchestrator/signals/send.document.email.signal';

const { sendDocumentEmail } = proxyActivities<EmailActivity>({
  startToCloseTimeout: '10 minute',
  taskQueue: 'main',
  cancellationType: 'ABANDON',
});

const RATE_LIMIT_MS = 700;

export async function sendEmailWorkflowV2({
  queue = [],
}: {
  queue: SendDocumentEmail[];
}) {
  let processedThisRun = 0;
  setHandler(sendDocumentEmailSignal, (addEmail: SendDocumentEmail) => {
    if (addEmail.to && addEmail.subject) {
      if (addEmail.addTo === 'top') {
        queue.unshift(addEmail);
      } else {
        queue.push(addEmail);
      }
    }
  });

  while (true) {
    await condition(() => queue.length > 0);

    try {
      const email = queue.shift()!;
      if (!email) {
        continue;
      }
      await sendDocumentEmail(
        email.to,
        email.subject,
        email.html,
        email.fullDocument,
        email.replyTo
      );
      processedThisRun++;
    } catch (err) {
      console.log(err);
    }

    await sleep(RATE_LIMIT_MS);

    if (processedThisRun >= 30) {
      return await continueAsNew({ queue });
    }
  }
}
