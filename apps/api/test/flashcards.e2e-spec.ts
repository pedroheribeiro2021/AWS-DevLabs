import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { prisma } from '@aws-devlab/database';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

describe('Flashcards (e2e)', () => {
  let app: INestApplication<App>;
  const email = `flashcards-e2e-${Date.now()}@example.com`;
  const password = 'password123';
  let accessToken: string;
  let flashcardId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Flashcards E2E' });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/flashcards').expect(401);
  });

  it('lists flashcards as NEW', async () => {
    const res = await request(app.getHttpServer())
      .get('/flashcards')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].state).toBe('NEW');
    flashcardId = res.body[0].id;
  });

  it('returns 404 for an unknown flashcard', async () => {
    await request(app.getHttpServer())
      .get('/flashcards/does-not-exist')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('returns flashcard detail with front and back', async () => {
    const res = await request(app.getHttpServer())
      .get(`/flashcards/${flashcardId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.front).toEqual(expect.any(String));
    expect(res.body.back).toEqual(expect.any(String));
  });

  it('advances state on correct reviews and demotes on a wrong one', async () => {
    const first = await request(app.getHttpServer())
      .post(`/flashcards/${flashcardId}/review`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ correct: true })
      .expect(201);
    expect(first.body.state).toBe('LEARNING');

    const second = await request(app.getHttpServer())
      .post(`/flashcards/${flashcardId}/review`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ correct: true })
      .expect(201);
    expect(second.body.state).toBe('REVIEW');

    const wrong = await request(app.getHttpServer())
      .post(`/flashcards/${flashcardId}/review`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ correct: false })
      .expect(201);
    expect(wrong.body.state).toBe('LEARNING');

    const listRes = await request(app.getHttpServer())
      .get('/flashcards')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const card = listRes.body.find((item: { id: string }) => item.id === flashcardId);
    expect(card.state).toBe('LEARNING');
  });
});
