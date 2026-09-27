import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { prisma } from '@aws-devlab/database';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

describe('Analytics (e2e)', () => {
  let app: INestApplication<App>;
  const email = `analytics-e2e-${Date.now()}@example.com`;
  const password = 'password123';
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Analytics E2E' });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/analytics/me').expect(401);
  });

  it('returns an empty diagnosis for a new user, pointing to the first lesson', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.overall.answeredQuestions).toBe(0);
    expect(res.body.overall.accuracyPercent).toBeNull();
    expect(res.body.domains.length).toBeGreaterThan(0);
    expect(res.body.weakTopics).toEqual([]);
    expect(res.body.recommendations[0].kind).toBe('CONTINUE_LESSONS');
    expect(res.body.history.weekly).toHaveLength(8);
  });

  it('counts a practice answer in its topic and in the current week', async () => {
    const topicId = (
      await request(app.getHttpServer())
        .get('/analytics/me')
        .set('Authorization', `Bearer ${accessToken}`)
    ).body.domains[0].topics[0].id;

    const questions = await request(app.getHttpServer())
      .get(`/questions?topicId=${topicId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(questions.body.length).toBeGreaterThan(0);
    expect(questions.body.every((q: { topic: { id: string } }) => q.topic.id === topicId)).toBe(true);

    const detail = await request(app.getHttpServer())
      .get(`/questions/${questions.body[0].id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    await request(app.getHttpServer())
      .post(`/questions/${questions.body[0].id}/answer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ selectedOptionIds: [detail.body.options[0].id] })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/analytics/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.overall.answeredQuestions).toBe(1);
    expect(res.body.domains[0].topics[0].answeredQuestions).toBe(1);
    expect(res.body.history.weekly.at(-1).answers).toBe(1);
  });
});
