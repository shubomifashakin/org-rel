import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

import dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: { methods: ['GET', 'POST', 'PUT', 'DELETE'], origin: '*' },
  });

  app.setGlobalPrefix('api/v1');
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
