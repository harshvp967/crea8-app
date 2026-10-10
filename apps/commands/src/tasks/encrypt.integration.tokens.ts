import { Command } from 'nestjs-command';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { encryptStoredIntegrationTokens } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.token.crypto';

@Injectable()
export class EncryptIntegrationTokens {
  @Command({
    command: 'encrypt-integration-tokens',
    describe:
      'Encrypt stored Integration.token and refreshToken values. Safe to run more than once.',
  })
  async run() {
    const db = new PrismaClient();
    try {
      const result = await encryptStoredIntegrationTokens(db);
      console.log(
        `encrypt-integration-tokens scanned=${result.scanned} updated=${result.updated}`
      );
    } finally {
      await db.$disconnect();
    }
  }
}
