import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { prisma } from '@aws-devlab/database';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

describe('Simulations (e2e)', () => {
  let app: INestApplication<App>;
  const email = `simulations-e2e-${Date.now()}@example.com`;
  const otherEmail = `simulations-e2e-other-${Date.now()}@example.com`;
  const password = 'password123';
  let accessToken: string;
  let otherAccessToken: string;
  let examVersionId: string;
  let attemptId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Simulations E2E' });
    accessToken = res.body.accessToken;

    const otherRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: otherEmail, password, name: 'Simulations E2E Other' });
    otherAccessToken = otherRes.body.accessToken;

    const examVersion = await prisma.examVersion.findFirst({ where: { code: 'DVA-C02' } });
    examVersionId = examVersion!.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [email, otherEmail] } } });
    await app.close();
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/simulations').expect(401);
  });

  it('starts a simulation with a config-driven question count and duration', async () => {
    const res = await request(app.getHttpServer())
      .post('/simulations/start')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ examVersionId, questionCount: 3, durationMinutes: 30 })
      .expect(201);

    expect(res.body.status).toBe('IN_PROGRESS');
    expect(res.body.questions).toHaveLength(3);
    expect(res.body.remainingSeconds).toBeGreaterThan(0);
    // correctness must never be revealed while in progress
    expect(res.body.questions[0].question.options[0].isCorrect).toBeUndefined();

    attemptId = res.body.id;
  });

  it('rejects starting a second simulation while one is in progress', async () => {
    await request(app.getHttpServer())
      .post('/simulations/start')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ examVersionId })
      .expect(409);
  });

  it("returns 404 (not 403) for another user's attempt", async () => {
    await request(app.getHttpServer())
      .get(`/simulations/${attemptId}`)
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .expect(404);
  });

  it('records an answer and a flag for a question without revealing correctness', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/simulations/${attemptId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const firstQuestion = detail.body.questions[0];
    const optionId = firstQuestion.question.options[0].id;

    const res = await request(app.getHttpServer())
      .patch(`/simulations/${attemptId}/questions/${firstQuestion.question.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ selectedOptionIds: [optionId], flagged: true })
      .expect(200);

    const updatedQuestion = res.body.questions.find(
      (item: { question: { id: string } }) => item.question.id === firstQuestion.question.id,
    );
    expect(updatedQuestion.answered).toBe(true);
    expect(updatedQuestion.flagged).toBe(true);
    expect(updatedQuestion.question.options[0].isCorrect).toBeUndefined();
  });

  it('rejects a review before submission', async () => {
    await request(app.getHttpServer())
      .get(`/simulations/${attemptId}/review`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('submits the simulation and grades it', async () => {
    const res = await request(app.getHttpServer())
      .post(`/simulations/${attemptId}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(res.body.status).toBe('COMPLETED');
    expect(typeof res.body.correctCount).toBe('number');
    expect(typeof res.body.scorePercent).toBe('number');
    expect(typeof res.body.passed).toBe('boolean');
  });

  it('reveals correctness and explanations in the review after submission', async () => {
    const res = await request(app.getHttpServer())
      .get(`/simulations/${attemptId}/review`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.questions).toHaveLength(3);
    expect(typeof res.body.questions[0].isCorrect).toBe('boolean');
    expect(res.body.questions[0].question.options.every((o: { explanation: string }) => o.explanation)).toBe(
      true,
    );
  });

  it('rejects further answer updates after submission', async () => {
    const review = await request(app.getHttpServer())
      .get(`/simulations/${attemptId}/review`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const firstQuestionId = review.body.questions[0].question.id;

    await request(app.getHttpServer())
      .patch(`/simulations/${attemptId}/questions/${firstQuestionId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ selectedOptionIds: ['whatever'] })
      .expect(400);
  });

  it('lists past attempts, newest first', async () => {
    const res = await request(app.getHttpServer())
      .get('/simulations')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].id).toBe(attemptId);
    expect(res.body[0].status).toBe('COMPLETED');
  });

  it('allows starting a new simulation now that the previous one is completed', async () => {
    await request(app.getHttpServer())
      .post('/simulations/start')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ examVersionId, questionCount: 1, durationMinutes: 30 })
      .expect(201);
  });
});
