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
  error: jest.fn(),
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

const invitersEmail = 'test@gmail.com';
const invitersUsername = 'testuser';
const invitedUsersMail = 'invitedUser@example.com';

describe('AppController (e2e)', () => {
  let app: NestExpressApplication;
  let cookies: string[] = [];
  let organizationId: string;
  let userId: string;
  let projectId: string;
  let organizationName: string;
  let invitersName: string;
  let inviteId: string;

  beforeAll(async () => {
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
    await databaseService.projects.deleteMany();
    await databaseService.organizationsOnUsers.deleteMany();
    await databaseService.organizations.deleteMany();

    await app.close();
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

  describe('Request Flow', () => {
    it('should sign up the user', async () => {
      const newName = 'test user';

      const req = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-up')
        .send({
          fullname: newName,
          email: invitersEmail,
          username: invitersUsername,
          password: 'UserPassword1234!',
        });

      cookies = req.headers['set-cookie'] as unknown as string[];
      expect(cookies).toHaveLength(2);
      expect(req.statusCode).toBe(200);
      expect(req.body).toEqual({ message: 'success' });
      invitersName = newName;
    });

    it('should create an organization', async () => {
      const req = await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Cookie', cookies)
        .send({
          name: 'Test Organization',
        });

      expect(req.statusCode).toBe(200);
      expect(req.body).toEqual({ id: expect.any(String) });
      expect(req.type).toBe('application/json');
    });

    it('should get organizations the signed in user is a member of', async () => {
      const req = await request(app.getHttpServer())
        .get('/api/v1/organizations')
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(200);
      expect(req.body).toEqual({
        organizations: expect.any(Array),
        hasNextPage: false,
      });
      expect(req.body.organizations).toHaveLength(1);
      expect(req.body.organizations[0]).toHaveProperty('id');
      expect(req.body.organizations[0]).toHaveProperty(
        'name',
        'Test Organization',
      );
      expect(req.type).toBe('application/json');
      organizationId = req.body.organizations[0].id;
    });

    it('should get the info of the organization created', async () => {
      const req = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}`)
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(200);

      expect(req.body).toHaveProperty('name');

      expect(req.type).toBe('application/json');
    });

    it('should update an organizations name', async () => {
      const newName = 'Updated Test Organization';

      const req = await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}`)
        .set('Cookie', cookies)
        .send({
          name: newName,
        });

      expect(req.statusCode).toBe(200);

      expect(req.body).toEqual({ message: 'success' });

      expect(req.type).toBe('application/json');
      organizationName = newName;
    });

    it('should get the users in the organization', async () => {
      const req = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/users`)
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(200);

      expect(req.body).toEqual({
        users: expect.any(Array),
        hasNextPage: false,
      });
      expect(req.body.users).toHaveLength(1);
      expect(req.type).toBe('application/json');

      userId = req.body.users[0].id;
    });

    it('should create a project in the organization', async () => {
      const req = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/projects`)
        .set('Cookie', cookies)
        .send({
          name: 'Test Project',
          userId: userId,
        });

      expect(req.statusCode).toBe(200);

      expect(req.body).toEqual({
        id: expect.any(String),
      });

      expect(req.type).toBe('application/json');
      projectId = req.body.id;
    });

    it('should not create a project in the organization due to invalid name', async () => {
      const req = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/projects`)
        .set('Cookie', cookies)
        .send({
          name: 'Te',
          userId: userId,
        });

      expect(req.statusCode).toBe(400);

      expect(req.type).toBe('application/json');
    });

    it('should get all the projects in the organization', async () => {
      const req = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/projects`)
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(200);

      expect(req.body).toEqual({
        projects: expect.any(Array),
        hasNextPage: false,
      });

      expect(req.body.projects).toHaveLength(1);
      expect(req.body.projects[0].id).toBe(projectId);
      expect(req.body.projects[0].name).toBe('Test Project');
      expect(req.body.projects[0].userId).toBe(userId);

      expect(req.type).toBe('application/json');
    });

    it('should update a project in the organization', async () => {
      const req = await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/projects/${projectId}`)
        .set('Cookie', cookies)
        .send({
          name: 'Updated Test Project',
        });

      expect(req.statusCode).toBe(200);

      expect(req.body).toEqual({
        message: 'success',
      });

      expect(req.type).toBe('application/json');
    });

    it('should delete a project in the organization', async () => {
      const req = await request(app.getHttpServer())
        .delete(`/api/v1/organizations/${organizationId}/projects/${projectId}`)
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(200);

      expect(req.body).toEqual({
        message: 'success',
      });

      const dbService = app.get(DatabaseService);
      const allProjects = await dbService.projects.findMany();
      expect(allProjects.length).toBe(0);

      expect(req.type).toBe('application/json');
    });

    it('should invite a user to an organization', async () => {
      const req = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/invites`)
        .set('Cookie', cookies)
        .send({
          email: invitedUsersMail,
          role: 'USER',
        });

      expect(req.statusCode).toBe(200);

      expect(req.body).toEqual({
        message: 'success',
      });

      expect(req.type).toBe('application/json');
    });

    it('should not invite a user due to invalid role', async () => {
      const req = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/invites`)
        .set('Cookie', cookies)
        .send({
          email: invitedUsersMail,
          role: 'MEMBER',
        });

      expect(req.statusCode).toBe(400);

      expect(req.type).toBe('application/json');
    });

    it('should not invite a user due to invalid email', async () => {
      const req = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/invites`)
        .set('Cookie', cookies)
        .send({
          email: 'invalid-email',
          role: 'USER',
        });

      expect(req.statusCode).toBe(400);

      expect(req.type).toBe('application/json');
    });

    it('should sign out the user', async () => {
      const req = await request(app.getHttpServer())
        .post(`/api/v1/auth/sign-out`)
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(200);

      expect(req.body).toEqual({
        message: 'success',
      });

      expect(req.type).toBe('application/json');
    });

    it('should sign up the invited user', async () => {
      const req = await request(app.getHttpServer())
        .post(`/api/v1/auth/sign-up`)
        .send({
          fullname: 'invited user',
          email: invitedUsersMail,
          username: 'inviteduser',
          password: 'UserPassword1234!',
        });

      cookies = req.headers['set-cookie'] as unknown as string[];
      expect(cookies).toHaveLength(2);
      expect(req.statusCode).toBe(200);
      expect(req.body).toEqual({ message: 'success' });
    });

    it('should get organizations the newly invited user is a member of', async () => {
      const req = await request(app.getHttpServer())
        .get('/api/v1/organizations')
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(200);
      expect(req.body).toEqual({
        organizations: expect.any(Array),
        hasNextPage: false,
      });
      expect(req.body.organizations).toHaveLength(0);

      expect(req.type).toBe('application/json');
    });

    it('should include an invite for the user', async () => {
      const req = await request(app.getHttpServer())
        .get(`/api/v1/accounts/me/invites`)
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(200);
      expect(req.body).toEqual({ invites: expect.any(Array) });
      expect(req.body.invites).toHaveLength(1);
      expect(req.body.invites[0]).toHaveProperty('id');
      expect(req.body.invites[0]).toHaveProperty(
        'organization',
        organizationName,
      );
      expect(req.body.invites[0]).toHaveProperty('inviter', invitersName);
      expect(req.body.invites[0]).toHaveProperty('role', 'USER');
      inviteId = req.body.invites[0].id;
    });

    it('should update the invites status to ACCEPTED', async () => {
      const req = await request(app.getHttpServer())
        .patch(`/api/v1/accounts/me/invites/${inviteId}`)
        .set('Cookie', cookies)
        .send({ status: 'ACCEPTED' });

      expect(req.statusCode).toBe(200);
      expect(req.body).toEqual({ message: 'success' });
    });

    it('should get organizations the newly invited user is a member of, after accepting invite', async () => {
      const req = await request(app.getHttpServer())
        .get('/api/v1/organizations')
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(200);
      expect(req.body).toEqual({
        organizations: expect.any(Array),
        hasNextPage: false,
      });
      expect(req.body.organizations).toHaveLength(1);
      expect(req.body.organizations[0]).toHaveProperty(
        'name',
        organizationName,
      );
      expect(req.body.organizations[0]).toHaveProperty('id', organizationId);

      expect(req.type).toBe('application/json');
    });

    it('should not allow the invited user to create a project because they are not admin', async () => {
      const req = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/projects`)
        .set('Cookie', cookies)
        .send({
          name: 'Test Project',
          userId: userId,
        });

      expect(req.statusCode).toBe(403);

      expect(req.type).toBe('application/json');
    });

    it('should not allow the invited user to delete a project because they are not admin', async () => {
      const req = await request(app.getHttpServer())
        .delete(`/api/v1/organizations/${organizationId}/projects/${projectId}`)
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(403);

      expect(req.type).toBe('application/json');
    });

    it('should not allow the invited user to update a project because they are not admin', async () => {
      const req = await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}/projects/${projectId}`)
        .set('Cookie', cookies)
        .send({ name: 'Updated Project Name' });

      expect(req.statusCode).toBe(403);

      expect(req.type).toBe('application/json');
    });

    it('should not allow the invited user to invite another user because they are not admin', async () => {
      const req = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${organizationId}/invites`)
        .set('Cookie', cookies)
        .send({
          email: invitedUsersMail,
          role: 'USER',
        });

      expect(req.statusCode).toBe(403);

      expect(req.type).toBe('application/json');
    });

    it('should not allow the invited user to update an organizations name because they are not admin', async () => {
      const newName = 'Updated Test Organization';

      const req = await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${organizationId}`)
        .set('Cookie', cookies)
        .send({
          name: newName,
        });

      expect(req.statusCode).toBe(403);

      expect(req.type).toBe('application/json');
    });

    it('should sign out the user', async () => {
      const req = await request(app.getHttpServer())
        .post(`/api/v1/auth/sign-out`)
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(200);

      expect(req.body).toEqual({
        message: 'success',
      });

      expect(req.type).toBe('application/json');
    });

    it('should sign in the inviter', async () => {
      const req = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-in')
        .send({
          username: invitersUsername,
          password: 'UserPassword1234!',
        });

      cookies = req.headers['set-cookie'] as unknown as string[];
      expect(cookies).toHaveLength(2);
      expect(req.statusCode).toBe(200);
      expect(req.body).toEqual({ message: 'success' });
    });

    it('should get the users in the organization', async () => {
      const req = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}/users`)
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(200);

      expect(req.body).toEqual({
        users: expect.any(Array),
        hasNextPage: false,
      });
      expect(req.body.users).toHaveLength(2);
      expect(req.type).toBe('application/json');
    });

    it('should delete the organization', async () => {
      const req = await request(app.getHttpServer())
        .delete(`/api/v1/organizations/${organizationId}`)
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(200);

      expect(req.body).toEqual({
        message: 'success',
      });

      const dbService = app.get(DatabaseService);
      const allOrganizations = await dbService.organizations.findMany();
      expect(allOrganizations.length).toBe(0);

      expect(req.type).toBe('application/json');
    });

    it('should sign out the user', async () => {
      const req = await request(app.getHttpServer())
        .post(`/api/v1/auth/sign-out`)
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(200);

      expect(req.body).toEqual({
        message: 'success',
      });

      expect(req.type).toBe('application/json');
    });

    it('should not allow unauthorized access to endpoint ', async () => {
      const req = await request(app.getHttpServer())
        .get('/api/v1/organizations')
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(401);

      expect(req.type).toBe('application/json');
    });

    it('should not allow unauthorized access to refresh token endpoint', async () => {
      const req = await request(app.getHttpServer())
        .get('/api/v1/auth/refresh')
        .set('Cookie', cookies);

      expect(req.statusCode).toBe(401);

      expect(req.type).toBe('application/json');
    });

    it('should not sign up the user with invalid data', async () => {
      const newName = 'test user';

      const req = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-up')
        .send({
          fullname: newName,
          email: invitersEmail,
          username: invitersUsername,
          password: 'InvalidPassword',
        });

      expect(req.statusCode).toBe(400);
    });
  });
});
