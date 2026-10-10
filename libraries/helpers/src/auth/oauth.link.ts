import { BadRequestException } from '@nestjs/common';

const BROKEN_CLIENT =
  /(?:^|[?&])(?:client_id|client_key)=(undefined|null|)(?:&|$)/;

export function assertOAuthRedirect(link: unknown) {
  const text = link == null ? '' : String(link);
  if (!text || BROKEN_CLIENT.test(text)) {
    throw new BadRequestException('Auth provider is not configured');
  }
  return text;
}
