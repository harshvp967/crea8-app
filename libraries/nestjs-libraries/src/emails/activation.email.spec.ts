import { activationEmailHtml } from '@gitroom/nestjs-libraries/emails/activation.email';
import {
  ACTIVATION_EMAIL_SUBJECT,
  EmailService,
} from '@gitroom/nestjs-libraries/services/email.service';

const LINK = 'https://app.crea8.one/auth/activate/tok&en=1<x>"y\'z';
const ESCAPED =
  'https://app.crea8.one/auth/activate/tok&amp;en=1&lt;x&gt;&quot;y&#39;z';

describe('activation email document', () => {
  const previousName = process.env.EMAIL_FROM_NAME;
  const previousAddress = process.env.EMAIL_FROM_ADDRESS;

  afterEach(() => {
    if (previousName === undefined) {
      delete process.env.EMAIL_FROM_NAME;
    } else {
      process.env.EMAIL_FROM_NAME = previousName;
    }
    if (previousAddress === undefined) {
      delete process.env.EMAIL_FROM_ADDRESS;
    } else {
      process.env.EMAIL_FROM_ADDRESS = previousAddress;
    }
  });

  it('injects an escaped activation link and leaves no placeholders', () => {
    const html = activationEmailHtml(LINK);
    expect(html.split(ESCAPED)).toHaveLength(5);
    expect(html).not.toContain('{{{');
    expect(html).toContain(`href="${ESCAPED}"`);
    expect(html).toContain(`>${ESCAPED}</a>`);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('https://app.crea8.one/crea8one-logo.png');
  });

  it('sends the activation document without the generic wrapper', async () => {
    process.env.EMAIL_FROM_NAME = 'Postiz';
    process.env.EMAIL_FROM_ADDRESS = 'noreply@crea8.one';
    const service = new EmailService({} as never);
    const sendEmail = jest.fn().mockResolvedValue({ id: 'email-1' });
    service.emailService = {
      name: 'resend',
      validateEnvKeys: [],
      sendEmail,
    };
    const html = activationEmailHtml(LINK);

    await expect(
      service.sendEmailSync(
        'person@example.com',
        ACTIVATION_EMAIL_SUBJECT,
        html,
        undefined,
        { fullDocument: true }
      )
    ).resolves.toBe(true);

    expect(sendEmail).toHaveBeenCalledWith(
      'person@example.com',
      'Activate your crea8.one account',
      html,
      'crea8.one',
      'noreply@crea8.one',
      undefined
    );
    const sent = String(sendEmail.mock.calls[0][2]);
    expect(sent).toBe(html);
    expect(sent).not.toContain('{{{');
    expect(sent).not.toContain('linear-gradient');
    expect(sent).not.toContain('account settings');
  });

  it('still wraps other emails, including this subject without the flag', async () => {
    process.env.EMAIL_FROM_NAME = 'Postiz';
    process.env.EMAIL_FROM_ADDRESS = 'noreply@crea8.one';
    const service = new EmailService({} as never);
    const sendEmail = jest.fn().mockResolvedValue({ id: 'email-2' });
    service.emailService = {
      name: 'resend',
      validateEnvKeys: [],
      sendEmail,
    };
    const plain = '<p>Other mail</p>';

    await service.sendEmailSync(
      'person@example.com',
      'Reset your password',
      plain
    );
    await service.sendEmailSync(
      'person@example.com',
      ACTIVATION_EMAIL_SUBJECT,
      plain
    );
    await service.sendEmailSync(
      'person@example.com',
      ACTIVATION_EMAIL_SUBJECT,
      activationEmailHtml(LINK),
      undefined,
      { fullDocument: false }
    );

    for (const call of sendEmail.mock.calls) {
      const wrapped = String(call[2]);
      expect(wrapped).toContain('linear-gradient');
      expect(wrapped).toContain('account settings');
      expect(wrapped).not.toBe(plain);
    }
  });

  it('routes on the fullDocument flag and not the subject', async () => {
    const signalWithStart = jest.fn().mockResolvedValue(undefined);
    const service = new EmailService({
      client: { getRawClient: () => ({ workflow: { signalWithStart } }) },
    } as never);

    await service.sendEmail(
      'person@example.com',
      ACTIVATION_EMAIL_SUBJECT,
      activationEmailHtml(LINK),
      'top'
    );
    expect(signalWithStart).toHaveBeenCalledWith(
      'sendEmailWorkflow',
      expect.objectContaining({
        workflowId: 'send_email',
        signal: 'sendEmail',
        signalArgs: [
          {
            to: 'person@example.com',
            subject: ACTIVATION_EMAIL_SUBJECT,
            html: activationEmailHtml(LINK),
            replyTo: undefined,
            addTo: 'top',
          },
        ],
      })
    );

    signalWithStart.mockClear();
    await service.sendEmail(
      'person@example.com',
      'Weekly digest',
      '<p>Digest</p>',
      'bottom',
      'reply@crea8.one',
      { fullDocument: true }
    );
    expect(signalWithStart).toHaveBeenCalledWith(
      'sendEmailWorkflowV2',
      expect.objectContaining({
        workflowId: 'send_email_document',
        signal: 'sendDocumentEmail',
        signalArgs: [
          {
            to: 'person@example.com',
            subject: 'Weekly digest',
            html: '<p>Digest</p>',
            replyTo: 'reply@crea8.one',
            addTo: 'bottom',
            fullDocument: true,
          },
        ],
      })
    );
  });
});
