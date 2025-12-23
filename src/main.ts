import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import compression from 'compression';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module.js';
import env from './core/serverEnv/index.js';
// import { MyLogger } from './core/logger/logger.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: { methods: ['GET', 'POST', 'PUT', 'DELETE'], origin: '*' },
    // bufferLogs: true,
  });

  // app.useLogger(app.get(MyLogger));
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.use(compression());
  app.use(cookieParser());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.set('trust proxy', true);
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  await app.listen(env.PORT);
}
bootstrap();
