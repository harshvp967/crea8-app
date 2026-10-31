import { Injectable } from '@nestjs/common';
import { SetsRepository } from '@gitroom/nestjs-libraries/database/prisma/sets/sets.repository';
import { SetsDto } from '@gitroom/nestjs-libraries/dtos/sets/sets.dto';
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';

@Injectable()
export class SetsService {
  constructor(
    private _setsRepository: SetsRepository,
    private _entitlements: EntitlementService
  ) {}

  getTotal(orgId: string) {
    return this._setsRepository.getTotal(orgId);
  }

  getSets(orgId: string) {
    return this._setsRepository.getSets(orgId);
  }

  async createSet(orgId: string, body: SetsDto) {
    await this._entitlements.assertFeature(orgId, 'postingSets');
    return this._setsRepository.createSet(orgId, body);
  }

  deleteSet(orgId: string, id: string) {
    return this._setsRepository.deleteSet(orgId, id);
  }
} 