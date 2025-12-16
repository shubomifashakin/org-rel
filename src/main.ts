import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import env from './core/serverEnv/index.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: { methods: ['GET', 'POST', 'PUT', 'DELETE'], origin: '*' },
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.set('trust proxy', true);
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  await app.listen(env.PORT);
}
bootstrap();
