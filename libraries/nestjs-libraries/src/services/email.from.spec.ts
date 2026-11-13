import { EmailService, emailFromName } from '@gitroom/nestjs-libraries/services/email.service';

describe('activation email sender', () => {
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

  it('uses crea8.one as the activation sender and leaves other mail on the configured name', () => {
    expect(emailFromName('Activate your crea8.one account', 'Postiz')).toBe(
      'crea8.one'
    );
    expect(emailFromName('Reset your password', 'Postiz')).toBe('Postiz');
  });

  it('sends the activation From display name without changing the footer markup', async () => {
    process.env.EMAIL_FROM_NAME = 'Postiz';
    process.env.EMAIL_FROM_ADDRESS = 'billing@example.com';
    const service = new EmailService({} as never);
    const sendEmail = jest.fn().mockResolvedValue({ id: 'email-1' });
    service.emailService = {
      name: 'test',
      validateEnvKeys: [],
      sendEmail,
    };
    await expect(
      service.sendEmailSync(
        'person@example.com',
        'Activate your crea8.one account',
        'Click <a href="https://app.crea8.one/auth/activate/token">here</a> to activate your account'
      )
    ).resolves.toBe(true);
    const html = String(sendEmail.mock.calls[0][2]);
    expect(sendEmail).toHaveBeenCalledWith(
      'person@example.com',
      'Activate your crea8.one account',
      expect.any(String),
      'crea8.one',
      'billing@example.com',
      undefined
    );
    expect(html).toContain('account settings');
    expect(html).toContain('auth/activate/token');
  });
});
