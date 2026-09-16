import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { prisma } from '@aws-devlab/database';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

describe('Questions (e2e)', () => {
  let app: INestApplication<App>;
  const email = `questions-e2e-${Date.now()}@example.com`;
  const password = 'password123';
  let accessToken: string;
  let questionId: string;
  let firstOptionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Questions E2E' });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/questions').expect(401);
  });

  it('rejects an invalid difficulty filter', async () => {
    await request(app.getHttpServer())
      .get('/questions?difficulty=NOT_A_LEVEL')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('lists questions as unanswered', async () => {
    const res = await request(app.getHttpServer())
      .get('/questions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].answered).toBe(false);
    questionId = res.body[0].id;
  });

  it('returns question detail without revealing correctness before answering', async () => {
    const res = await request(app.getHttpServer())
      .get(`/questions/${questionId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.answered).toBe(false);
    expect(res.body.options[0].isCorrect).toBeUndefined();
    expect(res.body.explanation).toBeUndefined();

    firstOptionId = res.body.options[0].id;
  });

  it('rejects an empty selection', async () => {
    await request(app.getHttpServer())
      .post(`/questions/${questionId}/answer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ selectedOptionIds: [] })
      .expect(400);
  });

  it('submits an answer and reveals correctness + explanations', async () => {
    const res = await request(app.getHttpServer())
      .post(`/questions/${questionId}/answer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ selectedOptionIds: [firstOptionId] })
      .expect(201);

    expect(typeof res.body.isCorrect).toBe('boolean');
    expect(res.body.answered).toBe(true);
    expect(res.body.options.every((option: { explanation: string }) => option.explanation)).toBe(
      true,
    );

    const detailRes = await request(app.getHttpServer())
      .get(`/questions/${questionId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(detailRes.body.answered).toBe(true);

    const listRes = await request(app.getHttpServer())
      .get('/questions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const question = listRes.body.find((item: { id: string }) => item.id === questionId);
    expect(question.answered).toBe(true);
  });
});
