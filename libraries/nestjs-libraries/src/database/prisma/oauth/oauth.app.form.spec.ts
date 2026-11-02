import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateOAuthAppDto } from '@gitroom/nestjs-libraries/dtos/oauth/create-oauth-app.dto';
import {
  CLIENT_ID_COPY_LABEL,
  REDIRECT_URL_ERROR,
  clientIdCopy,
  oauthCreateResult,
  oauthRedirectError,
} from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.app.form';

describe('OAuth client id copy', () => {
  it('copies the client id under a label that names it', () => {
    const copied = clientIdCopy('pca_client');
    expect(copied.label).toBe(CLIENT_ID_COPY_LABEL);
    expect(copied.label).toBe('Copy Client ID');
    expect(copied.value).toBe('pca_client');
  });
});

describe('OAuth app redirect URL', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: false });

  it('keeps the form open and returns an error for an incomplete redirect URL', async () => {
    expect(oauthRedirectError('https://')).toBe(REDIRECT_URL_ERROR);
    expect(oauthRedirectError('yourapp.com/callback')).toBe(REDIRECT_URL_ERROR);
    expect(oauthRedirectError('https://yourapp.com/callback')).toBe('');

    let message: unknown = '';
    try {
      await pipe.transform(
        { name: 'QA test', redirectUrl: 'https://' },
        { type: 'body', metatype: CreateOAuthAppDto }
      );
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      message = (err as BadRequestException).getResponse();
    }

    const body = message as { message?: string | string[] };
    const outcome = oauthCreateResult({ ok: false, message: body.message });
    expect(outcome.open).toBe(true);
    expect(outcome.error).toBe(REDIRECT_URL_ERROR);
  });
});
