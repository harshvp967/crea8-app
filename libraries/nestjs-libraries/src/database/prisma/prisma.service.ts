import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  decryptIntegrationTree,
  sealIntegrationWriteArgs,
} from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.token.crypto';

function withIntegrationTokenEncryption(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const result = await query(args);
          return decryptIntegrationTree(result);
        },
      },
      integration: {
        async $allOperations({ operation, args, query }) {
          sealIntegrationWriteArgs(
            operation,
            args as { data?: unknown; create?: unknown; update?: unknown }
          );
          const result = await query(args);
          return decryptIntegrationTree(result);
        },
      },
    },
  });
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  readonly extended: ReturnType<typeof withIntegrationTokenEncryption>;

  constructor() {
    super({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    });
    this.extended = withIntegrationTokenEncryption(this);
  }
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

@Injectable()
export class PrismaRepository<T extends keyof PrismaService> {
  public model: Pick<PrismaService, T>;
  constructor(private _prismaService: PrismaService) {
    this.model = this._prismaService.extended as unknown as Pick<
      PrismaService,
      T
    >;
  }
}

@Injectable()
export class PrismaTransaction {
  public model: Pick<PrismaService, '$transaction'>;
  constructor(private _prismaService: PrismaService) {
    this.model = this._prismaService.extended as unknown as Pick<
      PrismaService,
      '$transaction'
    >;
  }
}
