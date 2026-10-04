import { Injectable } from '@nestjs/common';
import { StalkerSourceProvider } from '@gitroom/nestjs-libraries/stalker/stalker.source';
import { YoutubeStalkerSource } from '@gitroom/nestjs-libraries/stalker/sources/youtube.stalker.source';
import { RedditStalkerSource } from '@gitroom/nestjs-libraries/stalker/sources/reddit.stalker.source';
import { XStalkerSource } from '@gitroom/nestjs-libraries/stalker/sources/x.stalker.source';
import { LinkedinStalkerSource } from '@gitroom/nestjs-libraries/stalker/sources/linkedin.stalker.source';

@Injectable()
export class StalkerSourceManager {
  private readonly sources: StalkerSourceProvider[] = [
    new YoutubeStalkerSource(),
    new RedditStalkerSource(),
    new XStalkerSource(),
    new LinkedinStalkerSource(),
  ];

  all() {
    return this.sources;
  }
}
