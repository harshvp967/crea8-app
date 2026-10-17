import { initializeSentry } from '@gitroom/nestjs-libraries/sentry/initialize.sentry';
initializeSentry('backend', true);
import { assertIntegrationTokenKey } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.token.crypto';

assertIntegrationTokenKey();

import { loadSwagger } from '@gitroom/helpers/swagger/load.swagger';
import { Runtime } from '@temporalio/worker';
Runtime.install({ shutdownSignals: [] });

process.env.TZ = 'UTC';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureHttp } from './http.setup';

import { SubscriptionExceptionFilter } from '@gitroom/backend/services/auth/permissions/subscription.exception';
import { PostValidationExceptionFilter } from '@gitroom/backend/api/routes/posts.validation.exception';
import { HttpExceptionFilter } from '@gitroom/nestjs-libraries/services/exception.filter';
import { ConfigurationChecker } from '@gitroom/helpers/configuration/configuration.checker';
import { startMcp } from '@gitroom/nestjs-libraries/chat/start.mcp';
import { mcpCorsOrigins } from '@gitroom/nestjs-libraries/chat/mcp.public.origin';

async function start() {
  // CORS is set up in configureHttp, not through these options (see there).
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  await startMcp(app);

  configureHttp(app, mcpCorsOrigins());

  app.useGlobalFilters(new SubscriptionExceptionFilter());
  app.useGlobalFilters(new PostValidationExceptionFilter());
  app.useGlobalFilters(new HttpExceptionFilter());

  loadSwagger(app);

  const port = process.env.PORT || 3000;

  try {
    await app.listen(port);
    console.log('Backend started successfully on port ' + port);

    checkConfiguration(); // Do this last, so that users will see obvious issues at the end of the startup log without having to scroll up.

    Logger.log(`🚀 Backend is running on: http://localhost:${port}`);
  } catch (e) {
    Logger.error(`Backend failed to start on port ${port}`, e);
  }
}

function checkConfiguration() {
  const checker = new ConfigurationChecker();
  checker.readEnvFromProcess();
  checker.check();

  if (checker.hasIssues()) {
    for (const issue of checker.getIssues()) {
      Logger.warn(issue, 'Configuration issue');
    }

    Logger.warn('Configuration issues found: ' + checker.getIssuesCount());
  } else {
    Logger.log('Configuration check completed without any issues');
  }
}

start();
