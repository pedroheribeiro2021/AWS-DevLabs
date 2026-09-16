import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { CertificationsModule } from './certifications/certifications.module.js';
import { validateEnv } from './config/env.validation.js';
import { FlashcardsModule } from './flashcards/flashcards.module.js';
import { LabsModule } from './labs/labs.module.js';
import { LearningModule } from './learning/learning.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QuestionsModule } from './questions/questions.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    CertificationsModule,
    LearningModule,
    LabsModule,
    QuestionsModule,
    FlashcardsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
