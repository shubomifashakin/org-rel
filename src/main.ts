import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import env from './core/serverEnv/index.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: { methods: ['GET', 'POST', 'PUT', 'DELETE'], origin: '*' },
  });

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  await app.listen(env.PORT);
}
bootstrap();
