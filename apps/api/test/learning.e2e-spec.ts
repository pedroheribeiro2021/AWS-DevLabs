import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { prisma } from '@aws-devlab/database';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

describe('Learning (e2e)', () => {
  let app: INestApplication<App>;
  const email = `learning-e2e-${Date.now()}@example.com`;
  const password = 'password123';
  const certificationSlug = 'aws-certified-developer-associate';
  let accessToken: string;
  let lessonId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Learning E2E' });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects unauthenticated access to the track', async () => {
    await request(app.getHttpServer())
      .get(`/learning/track/${certificationSlug}`)
      .expect(401);
  });

  it('returns the learning track with lessons marked NOT_STARTED', async () => {
    const res = await request(app.getHttpServer())
      .get(`/learning/track/${certificationSlug}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.slug).toBe(certificationSlug);
    const lesson = res.body.examVersions[0].domains[0].topics[0].lessons[0];
    expect(lesson.status).toBe('NOT_STARTED');
    lessonId = lesson.id;
  });

  it('returns 404 for an unknown certification', async () => {
    await request(app.getHttpServer())
      .get('/learning/track/does-not-exist')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('returns lesson detail with resources', async () => {
    const res = await request(app.getHttpServer())
      .get(`/learning/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.title).toBe('O que é o AWS Lambda?');
    expect(res.body.resources.length).toBeGreaterThan(0);
    expect(res.body.status).toBe('NOT_STARTED');
  });

  it('marks a lesson as completed and reflects it on the track', async () => {
    await request(app.getHttpServer())
      .post(`/learning/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const trackRes = await request(app.getHttpServer())
      .get(`/learning/track/${certificationSlug}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const lesson = trackRes.body.examVersions[0].domains[0].topics[0].lessons[0];
    expect(lesson.status).toBe('COMPLETED');
  });
});
