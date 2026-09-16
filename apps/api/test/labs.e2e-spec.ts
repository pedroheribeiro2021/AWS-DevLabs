import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { prisma } from '@aws-devlab/database';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

describe('Labs (e2e)', () => {
  let app: INestApplication<App>;
  const email = `labs-e2e-${Date.now()}@example.com`;
  const password = 'password123';
  let accessToken: string;
  let labId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Labs E2E' });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/labs').expect(401);
  });

  it('lists labs with NOT_STARTED status', async () => {
    const res = await request(app.getHttpServer())
      .get('/labs')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].status).toBe('NOT_STARTED');
    labId = res.body[0].id;
  });

  it('returns 404 for an unknown lab', async () => {
    await request(app.getHttpServer())
      .get('/labs/does-not-exist')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('returns lab detail with ordered steps', async () => {
    const res = await request(app.getHttpServer())
      .get(`/labs/${labId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.steps.length).toBeGreaterThan(0);
    expect(res.body.status).toBe('NOT_STARTED');
  });

  it('starts and completes a lab attempt', async () => {
    const startRes = await request(app.getHttpServer())
      .post(`/labs/${labId}/start`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    expect(startRes.body.status).toBe('IN_PROGRESS');

    const completeRes = await request(app.getHttpServer())
      .post(`/labs/${labId}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    expect(completeRes.body.status).toBe('COMPLETED');

    const listRes = await request(app.getHttpServer())
      .get('/labs')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const lab = listRes.body.find((item: { id: string }) => item.id === labId);
    expect(lab.status).toBe('COMPLETED');
  });
});
