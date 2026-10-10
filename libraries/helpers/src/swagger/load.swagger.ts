import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { isProductionRuntime } from '@gitroom/helpers/utils/is.production';

// Production (NODE_ENV=production or Railway) keeps /docs and /docs-json off
// unless ENABLE_SWAGGER=true. Local dev stays on.
export const swaggerEnabled = () => {
  if (process.env.ENABLE_SWAGGER === 'true') {
    return true;
  }
  if (process.env.ENABLE_SWAGGER === 'false') {
    return false;
  }
  return !isProductionRuntime();
};

export const loadSwagger = (app: INestApplication) => {
  if (!swaggerEnabled()) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Crea8one Swagger file')
    .setDescription('API description')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
};
