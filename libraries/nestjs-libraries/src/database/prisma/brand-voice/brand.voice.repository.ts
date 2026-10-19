import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

@Injectable()
export class BrandVoiceRepository {
  constructor(private _brandVoice: PrismaRepository<'brandVoice'>) {}

  find(organizationId: string) {
    return this._brandVoice.model.brandVoice.findUnique({
      where: { organizationId },
    });
  }

  save(organizationId: string, traits: string) {
    return this._brandVoice.model.brandVoice.upsert({
      where: { organizationId },
      create: {
        organizationId,
        traits,
        enabled: false,
      },
      update: {
        traits,
      },
    });
  }

  setEnabled(organizationId: string, enabled: boolean) {
    return this._brandVoice.model.brandVoice.update({
      where: { organizationId },
      data: { enabled },
    });
  }
}
