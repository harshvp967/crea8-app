import { Injectable, Logger } from '@nestjs/common';
import { Gta6clipsRepository } from '@gitroom/nestjs-libraries/partner/gta6clips.repository';
import { arrivePartnerLink, completePartnerLink } from '@gitroom/nestjs-libraries/partner/gta6clips.flow';
import { gta6clipsSecret } from '@gitroom/nestjs-libraries/partner/gta6clips.token';
import { AuthService } from '@gitroom/helpers/auth/auth.service';

@Injectable()
export class Gta6clipsService {
  private readonly log = new Logger('gta6clips');

  constructor(private _store: Gta6clipsRepository) {}

  private note(event: string, fields: Record<string, string | boolean | null | undefined>) {
    const extra = Object.entries(fields)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${value}`)
      .join(' ');
    this.log.log(`${event}${extra ? ` ${extra}` : ''}`);
  }

  async exchange(input: { token?: string; video?: string; caption?: string }) {
    const result = await arrivePartnerLink({ ...input, secret: gta6clipsSecret() }, this._store);
    this.note(result.status, {
      grant: result.grant,
      org: result.status === 'session' ? result.organizationId : undefined,
      email: result.status === 'collision' ? result.email : undefined,
    });
    if (result.status !== 'session') {
      return result;
    }
    return { ...result, auth: AuthService.signJWT({ id: result.userId }) };
  }

  async link(input: { pendingId: string; userId: string; email: string; organizationId: string }) {
    const result = await completePartnerLink(input, this._store);
    this.note(result.status === 'session' ? 'linked' : result.status, {
      org: input.organizationId,
      grant: result.grant,
    });
    if (result.status !== 'session') {
      return result;
    }
    return { ...result, auth: AuthService.signJWT({ id: result.userId }) };
  }
}
