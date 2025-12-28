import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from './../src/app.module.js';
import { AppLoggerService } from './../src/core/app-logger/app-logger.service.js';
import { SecretsManagerService } from './../src/core/secrets-manager/secrets-manager.service.js';
import cookieParser from 'cookie-parser';
import { DatabaseService } from './../src/core/database/database.service.js';

const myLoggerMock = {
  log: jest.fn(),
  error: jest.fn().mockImplementation((data) => {
    console.log(data);
  }),
  warn: jest.fn(),
  debug: jest.fn(),
  logError: jest.fn(),
};

const mySecretsManagerServiceMock = {
  getSecret: jest.fn().mockResolvedValue({
    status: true,
    data: { JWT_SECRET: 'OrY9mUHrNkzzDcxYWdxAV6SxdVDQqP9jczghlhGE97Q=' },
    error: null,
  }),
};

describe('AppController (e2e)', () => {
  let app: NestExpressApplication;
  let cookies: string[] = [];

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AppLoggerService)
      .useValue(myLoggerMock)
      .overrideProvider(SecretsManagerService)
      .useValue(mySecretsManagerServiceMock)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();

    const logger = app.get(AppLoggerService);
    app.useLogger(logger);
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.use(cookieParser());
    app.set('trust proxy', true);

    await app.init();

    jest.clearAllMocks();
  });

  afterAll(async () => {
    const databaseService = app.get(DatabaseService);
    await databaseService.users.deleteMany();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('time');
      });
  });

  describe('Auth Controller', () => {
    it('should sign up the user', async () => {
      const req = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-up')
        .send({
          fullname: 'test user',
          email: 'test@gmail.com',
          username: 'test',
          password: 'UserPassword1234!',
        });

      cookies = req.headers['set-cookie'] as unknown as string[];
      expect(cookies).toHaveLength(2);
      expect(req.statusCode).toBe(201);
      expect(req.body).toEqual({ message: 'success' });
    });

    it('should sign out the user', async () => {
      const req = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-out')
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(201);
      expect(req.body).toEqual({ message: 'success' });
      expect(req.type).toBe('application/json');
    });
  });
});
