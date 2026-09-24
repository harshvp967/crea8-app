import { Module } from '@nestjs/common';
import { CommandModule as ExternalCommandModule } from 'nestjs-command';
import { DatabaseModule } from '@gitroom/nestjs-libraries/database/prisma/database.module';
import { RefreshTokens } from './tasks/refresh.tokens';
import { ConfigurationTask } from './tasks/configuration';

@Module({
  imports: [ExternalCommandModule, DatabaseModule],
  controllers: [],
  providers: [RefreshTokens, ConfigurationTask],
  get exports() {
    return [...this.imports, ...this.providers];
  },
})
export class CommandModule {}
